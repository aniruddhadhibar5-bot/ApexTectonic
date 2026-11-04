"use client";

import { useEffect, useState } from "react";

type Locale = "en-US" | "ja-JP";
type Sample = { features: number[]; label: 0 | 1 };
type ModelReport = {
  weights: number[];
  bias: number;
  epochs: number;
  trainSamples: number;
  validationSamples: number;
  accuracy: number;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  validationLoss: number;
  confusion: { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number };
  trainedAt: string;
  dataset: string;
};

const STORAGE_KEY = "hyperion-synthetic-model-v1";
const EPOCHS = 260;
const FEATURE_COUNT = 6;

const copy = {
  "en-US": {
    eyebrow: "LOCAL AI WORKBENCH / RESEARCH ONLY",
    title: "Offline model training lab",
    description:
      "One-click, browser-local training and holdout evaluation for a toy two-class synthetic waveform-feature dataset. Nothing is uploaded; the result is not trained on real earthquakes and must never be treated as a forecast or alert.",
    label: "SYNTHETIC DATA ONLY · NOT A PREDICTOR",
    run: "Generate data + train model",
    running: "Training in this browser…",
    export: "Export model report",
    clear: "Clear saved model",
    setup: "This lab generates reproducible synthetic feature rows, shuffles them into train/validation partitions, and fits a logistic classifier with gradient descent.",
    privacy: "Training runs entirely in this browser. Model weights and metrics are saved locally on this device only. No account, server, or external ML API is used.",
    boundary: "Synthetic demonstrations do not establish earthquake prediction skill. Validation scores here describe only this generated toy dataset—not real-world accuracy, calibration, probability, or safety.",
    noModel: "No local model trained yet.",
    model: "LATEST LOCAL TRAINING RUN",
    dataset: "DATASET",
    split: "TRAIN / VALIDATION",
    epochs: "EPOCHS",
    accuracy: "HOLDOUT ACCURACY",
    precision: "HOLDOUT PRECISION",
    recall: "HOLDOUT RECALL",
    falsePositiveRate: "HOLDOUT FALSE-POSITIVE RATE",
    loss: "HOLDOUT LOG LOSS",
    confusion: "VALIDATION CONFUSION MATRIX",
    actualPositive: "Actual signal",
    actualBackground: "Actual background",
    predictedPositive: "Predicted signal",
    predictedBackground: "Predicted background",
    features: "Toy input features (normalized)",
    featureNames: ["Energy", "Spectral-band ratio", "Impulse score", "Node agreement", "Noise level", "Missing-node ratio"],
    exported: "Download JSON report",
    reset: "Saved model cleared.",
    saveError: "Could not save this model in browser storage.",
    loadError: "The saved model report could not be read. Run training again.",
  },
  "ja-JP": {
    eyebrow: "ローカルAI作業台 / 研究専用",
    title: "オフライン・モデル学習ラボ",
    description:
      "合成波形特徴量を使い、ブラウザー内で二分類モデルを学習・検証するデモです。データ送信はありません。実地震データで学習しておらず、予測や警報として使用できません。",
    label: "合成データのみ · 予測器ではありません",
    run: "データ生成とモデル学習",
    running: "このブラウザー内で学習中…",
    export: "モデルレポートを出力",
    clear: "保存済みモデルを削除",
    setup: "再現可能な合成特徴量を生成し、学習用と検証用に分割して、勾配降下法でロジスティック分類器を学習します。",
    privacy: "学習はブラウザー内だけで実行します。モデルの重みと指標はこの端末内に保存されます。アカウント、サーバー、外部ML APIは使用しません。",
    boundary: "合成デモは地震予測能力の根拠にはなりません。ここに表示する検証スコアは生成した玩具データだけの指標であり、実世界の精度・確率校正・安全性を示しません。",
    noModel: "端末内に学習済みモデルはありません。",
    model: "最新の端末内学習結果",
    dataset: "データセット",
    split: "学習 / 検証",
    epochs: "学習回数",
    accuracy: "検証正解率",
    precision: "検証適合率",
    recall: "検証再現率",
    falsePositiveRate: "検証偽陽性率",
    loss: "検証対数損失",
    confusion: "検証混同行列",
    actualPositive: "実際：信号",
    actualBackground: "実際：背景",
    predictedPositive: "予測：信号",
    predictedBackground: "予測：背景",
    features: "玩具入力特徴量（正規化済み）",
    featureNames: ["信号エネルギー", "スペクトル帯域比", "インパルス指標", "ノード一致度", "ノイズ量", "欠測ノード率"],
    exported: "JSONレポートを保存しました",
    reset: "保存済みモデルを削除しました。",
    saveError: "ブラウザー内にモデルを保存できませんでした。",
    loadError: "保存済みモデルレポートを読み込めません。再度学習を実行してください。",
  },
} as const;

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createSyntheticDataset(): Sample[] {
  const random = randomGenerator(0x48595052);
  const samples: Sample[] = [];
  for (let index = 0; index < 1200; index += 1) {
    const label: 0 | 1 = index % 2 as 0 | 1;
    const uniform = () => random();
    const between = (min: number, max: number) => min + uniform() * (max - min);
    const features = label === 1
      ? [
          between(0.55, 1),
          between(0.62, 1),
          between(0.38, 0.9),
          between(0.58, 1),
          between(0.02, 0.43),
          between(0, 0.25),
        ]
      : [
          between(0.05, 0.78),
          between(0.05, 0.74),
          between(0.02, 0.76),
          between(0.05, 0.79),
          between(0.38, 1),
          between(0, 0.68),
        ];
    samples.push({ features, label });
  }
  return samples;
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const z = Math.exp(-Math.min(value, 40));
    return 1 / (1 + z);
  }
  const z = Math.exp(Math.max(value, -40));
  return z / (1 + z);
}

function logit(features: number[], weights: number[], bias: number): number {
  return features.reduce((sum, feature, index) => sum + feature * weights[index], bias);
}

function trainModel(): ModelReport {
  const allSamples = createSyntheticDataset();
  const random = randomGenerator(0x53454e54);
  const shuffled = [...allSamples];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const validationSamples = shuffled.slice(0, 240);
  const trainingSamples = shuffled.slice(240);
  let weights = Array.from({ length: FEATURE_COUNT }, () => 0);
  let bias = 0;

  for (let epoch = 0; epoch < EPOCHS; epoch += 1) {
    const gradients = Array.from({ length: FEATURE_COUNT }, () => 0);
    let biasGradient = 0;
    for (const sample of trainingSamples) {
      const prediction = sigmoid(logit(sample.features, weights, bias));
      const error = prediction - sample.label;
      sample.features.forEach((feature, index) => {
        gradients[index] += error * feature;
      });
      biasGradient += error;
    }
    const rate = 0.7 / trainingSamples.length;
    weights = weights.map((weight, index) => weight - rate * gradients[index]);
    bias -= rate * biasGradient;
  }

  const confusion = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
  let validationLoss = 0;
  for (const sample of validationSamples) {
    const probability = sigmoid(logit(sample.features, weights, bias));
    const predicted = probability >= 0.5 ? 1 : 0;
    validationLoss -= sample.label === 1
      ? Math.log(Math.max(probability, 1e-12))
      : Math.log(Math.max(1 - probability, 1e-12));
    if (sample.label === 1 && predicted === 1) confusion.truePositive += 1;
    else if (sample.label === 0 && predicted === 1) confusion.falsePositive += 1;
    else if (sample.label === 0) confusion.trueNegative += 1;
    else confusion.falseNegative += 1;
  }
  const safeDivide = (numerator: number, denominator: number) => denominator === 0 ? 0 : numerator / denominator;
  const correct = confusion.truePositive + confusion.trueNegative;
  return {
    weights,
    bias,
    epochs: EPOCHS,
    trainSamples: trainingSamples.length,
    validationSamples: validationSamples.length,
    accuracy: safeDivide(correct, validationSamples.length),
    precision: safeDivide(confusion.truePositive, confusion.truePositive + confusion.falsePositive),
    recall: safeDivide(confusion.truePositive, confusion.truePositive + confusion.falseNegative),
    falsePositiveRate: safeDivide(confusion.falsePositive, confusion.falsePositive + confusion.trueNegative),
    validationLoss: safeDivide(validationLoss, validationSamples.length),
    confusion,
    trainedAt: new Date().toISOString(),
    dataset: "synthetic-waveform-features-v1",
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function isModelReport(value: unknown): value is ModelReport {
  if (typeof value !== "object" || value === null) return false;
  const report = value as Record<string, unknown>;
  const confusion = report.confusion;
  if (typeof confusion !== "object" || confusion === null) return false;
  const matrix = confusion as Record<string, unknown>;
  const counts = [matrix.truePositive, matrix.falsePositive, matrix.trueNegative, matrix.falseNegative];
  const isCount = (count: unknown) => typeof count === "number" && Number.isInteger(count) && count >= 0;
  const metrics = [report.accuracy, report.precision, report.recall, report.falsePositiveRate];
  return (
    Array.isArray(report.weights) &&
    report.weights.length === FEATURE_COUNT &&
    report.weights.every((weight) => typeof weight === "number" && Number.isFinite(weight)) &&
    typeof report.bias === "number" &&
    Number.isFinite(report.bias) &&
    typeof report.epochs === "number" &&
    Number.isInteger(report.epochs) &&
    report.epochs > 0 &&
    typeof report.trainSamples === "number" &&
    Number.isInteger(report.trainSamples) &&
    report.trainSamples > 0 &&
    typeof report.validationSamples === "number" &&
    Number.isInteger(report.validationSamples) &&
    report.validationSamples > 0 &&
    metrics.every((metric) => typeof metric === "number" && Number.isFinite(metric) && metric >= 0 && metric <= 1) &&
    typeof report.validationLoss === "number" &&
    Number.isFinite(report.validationLoss) &&
    report.validationLoss >= 0 &&
    counts.every(isCount) &&
    counts.reduce<number>((total, count) => total + (typeof count === "number" ? count : 0), 0) === report.validationSamples &&
    typeof report.trainedAt === "string" &&
    Number.isFinite(Date.parse(report.trainedAt)) &&
    report.dataset === "synthetic-waveform-features-v1"
  );
}

export default function TrainingLab({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [report, setReport] = useState<ModelReport | null>(null);
  const [training, setTraining] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === null) return;
      const parsed: unknown = JSON.parse(saved);
      if (isModelReport(parsed)) {
        setReport(parsed);
      } else {
        console.error("Saved synthetic model report has an invalid shape");
        setMessage(text.loadError);
      }
    } catch (loadError) {
      console.error("Could not load the saved synthetic model report", loadError);
      setMessage(text.loadError);
    }
  }, [text.loadError]);

  function runTraining() {
    setTraining(true);
    setMessage("");
    window.setTimeout(() => {
      try {
        const nextReport = trainModel();
        setReport(nextReport);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReport));
        } catch (storageError) {
          console.error("Could not save synthetic model report", storageError);
          setMessage(text.saveError);
        }
      } catch (trainingError) {
        console.error("Local synthetic model training failed", trainingError);
        setMessage(text.saveError);
      } finally {
        setTraining(false);
      }
    }, 20);
  }

  function exportReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ ...report, evidenceBoundary: text.boundary }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hyperion-synthetic-model-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearReport() {
    setReport(null);
    setMessage(text.reset);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (storageError) {
      console.error("Could not clear the local model report", storageError);
      setMessage(text.saveError);
    }
  }

  return (
    <section className="training-lab-section panel" id="training-lab">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{text.title}</h2>
          <p className="scenario-description">{text.description}</p>
        </div>
        <span className="training-boundary-tag">{text.label}</span>
      </div>
      <div className="training-lab-grid">
        <div className="training-controls-panel">
          <p>{text.setup}</p>
          <p className="training-privacy-note">{text.privacy}</p>
          <div className="training-actions">
            <button type="button" className="train-model-button" onClick={runTraining} disabled={training}>
              {training ? text.running : text.run}
            </button>
            <button type="button" className="training-clear-button" onClick={clearReport} disabled={!report || training}>{text.clear}</button>
          </div>
          <div className="training-feature-list">
            <strong>{text.features}</strong>
            {text.featureNames.map((feature, index) => (
              <span key={feature}><i>0{index + 1}</i>{feature}</span>
            ))}
          </div>
        </div>
        <div className="training-report-panel" aria-live="polite">
          {report ? (
            <>
              <div className="training-report-heading">
                <span>{text.model}</span>
                <time dateTime={report.trainedAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.trainedAt))}</time>
              </div>
              <div className="training-metrics">
                <div><small>{text.dataset}</small><strong>{report.dataset}</strong></div>
                <div><small>{text.split}</small><strong>{report.trainSamples} / {report.validationSamples}</strong></div>
                <div><small>{text.epochs}</small><strong>{report.epochs}</strong></div>
                <div><small>{text.accuracy}</small><strong>{formatPercent(report.accuracy)}</strong></div>
                <div><small>{text.precision}</small><strong>{formatPercent(report.precision)}</strong></div>
                <div><small>{text.recall}</small><strong>{formatPercent(report.recall)}</strong></div>
                <div><small>{text.falsePositiveRate}</small><strong>{formatPercent(report.falsePositiveRate)}</strong></div>
                <div><small>{text.loss}</small><strong>{report.validationLoss.toFixed(3)}</strong></div>
              </div>
              <div className="confusion-matrix">
                <strong>{text.confusion}</strong>
                <div className="confusion-grid">
                  <span />
                  <span>{text.predictedPositive}</span>
                  <span>{text.predictedBackground}</span>
                  <span>{text.actualPositive}</span>
                  <strong>{report.confusion.truePositive}</strong>
                  <strong>{report.confusion.falseNegative}</strong>
                  <span>{text.actualBackground}</span>
                  <strong>{report.confusion.falsePositive}</strong>
                  <strong>{report.confusion.trueNegative}</strong>
                </div>
              </div>
              <button type="button" className="export-model-button" onClick={exportReport}>{text.export}</button>
            </>
          ) : <p className="training-empty">{text.noModel}</p>}
        </div>
      </div>
      <p className="training-boundary-note"><span>i</span>{text.boundary}</p>
      {message && <p className="training-status-message" role="status">{message}</p>}
    </section>
  );
}
