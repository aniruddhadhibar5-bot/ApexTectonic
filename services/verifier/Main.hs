module Main where

import Data.List (nub)
import System.Exit (exitFailure)

data Candidate = Candidate
  { eventId :: String
  , modelScorePpm :: Int
  , consensusPpm :: Int
  , stationIds :: [String]
  , qualityFlags :: [String]
  }

data Decision = EligibleForHumanReview | Denied [String]
  deriving (Eq, Show)

minimumScorePpm :: Int
minimumScorePpm = 999990

minimumIndependentStations :: Int
minimumIndependentStations = 3

verify :: Candidate -> Decision
verify candidate
  | null (eventId candidate) = Denied ["missing event id"]
  | modelScorePpm candidate < 0 || modelScorePpm candidate > 1000000 =
      Denied ["model score outside parts-per-million range"]
  | consensusPpm candidate < 0 || consensusPpm candidate > 1000000 =
      Denied ["consensus outside parts-per-million range"]
  | modelScorePpm candidate < minimumScorePpm = Denied ["model score below review threshold"]
  | consensusPpm candidate < minimumScorePpm = Denied ["consensus below review threshold"]
  | length distinctStations < minimumIndependentStations =
      Denied ["insufficient independent stations"]
  | any null distinctStations = Denied ["empty station id"]
  | not (null (qualityFlags candidate)) = Denied ["quality flags present"]
  | otherwise = EligibleForHumanReview
  where
    distinctStations = nub (stationIds candidate)

main :: IO ()
main = do
  let valid = Candidate "synthetic" 999990 999990 ["station-a", "station-b", "station-c"] []
      outOfRange = valid { modelScorePpm = 1000001 }
      duplicateStations = valid { stationIds = ["station-a", "station-a", "station-a"] }
  if verify valid /= EligibleForHumanReview then exitFailure else pure ()
  if verify outOfRange == EligibleForHumanReview then exitFailure else pure ()
  if verify duplicateStations == EligibleForHumanReview then exitFailure else pure ()
  putStrLn "Review-only policy checks passed; this does not prove safety or control actuators."
