if [ $# -eq 0 ]
then
  echo "Please provide the run number"
  echo "USAGE: ./run.sh x"
  exit 1
fi

mkdir -p results/run$1

node --max-old-space-size=25600 scripts/put.js | tee results/run$1/put.csv
node --max-old-space-size=25600 scripts/get.js | tee results/run$1/get.csv
node --max-old-space-size=25600 scripts/batch.js | tee results/run$1/batch.csv
