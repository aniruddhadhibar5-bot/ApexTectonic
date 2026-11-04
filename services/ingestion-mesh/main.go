package main

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"
)

type Batch struct {
	StationID string
	Sequence  uint64
	Samples   []float32
}

type Sink interface {
	Write(context.Context, Batch) error
}

type LogSink struct{}

func (LogSink) Write(ctx context.Context, batch Batch) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		log.Printf("received station=%q sequence=%d samples=%d",
			batch.StationID, batch.Sequence, len(batch.Samples))
		return nil
	}
}

func route(ctx context.Context, input <-chan Batch, sink Sink, workers int) error {
	if sink == nil {
		return errors.New("sink is required")
	}
	if workers < 1 {
		return errors.New("workers must be positive")
	}

	workerCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	var group sync.WaitGroup
	errs := make(chan error, workers)
	for range workers {
		group.Add(1)
		go func() {
			defer group.Done()
			for {
				select {
				case <-workerCtx.Done():
					return
				case batch, ok := <-input:
					if !ok {
						return
					}
					if err := sink.Write(workerCtx, batch); err != nil {
						select {
						case errs <- err:
						default:
						}
						cancel()
						return
					}
				}
			}
		}()
	}

	done := make(chan struct{})
	go func() {
		group.Wait()
		close(done)
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errs:
		return err
	case <-done:
		return nil
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	input := make(chan Batch)
	close(input)

	err := route(ctx, input, LogSink{}, 1)
	if err != nil && !errors.Is(err, context.Canceled) {
		log.Printf("ingestion stopped: %v", err)
	}
}
