#!/bin/bash
# Lighthouse 13.6.0, perfil móvil por defecto (Moto G Power emulado, 4G lento simulado: 1,6 Mbps, RTT 150 ms, CPU x4)
export CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
cd "$1/lh"
for i in 1 2 3 4 5; do
  npx --yes lighthouse@13.6.0 https://lorenestudiodebelleza.vercel.app/ \
    --only-categories=performance --form-factor=mobile \
    --chrome-flags="--headless=new --no-sandbox" \
    --output=json --output=html --output-path="./home-$i" --quiet 2>&1 | tail -2
  echo "run $i done"
done
echo ALL_DONE
