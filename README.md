# RotaMax (Expo React Native)

Clone simplificado do Circuit Route Planner, com:
- Adicionar múltiplos endereços (geocoding via Nominatim)
- Otimização de paradas (OSRM Trip API)
- Traçado de rota e polyline (OSRM Route API)
- Mapa nativo com `react-native-maps`
- Uso de GPS (expo-location)

## Requisitos
- Conta no Expo (gratuita)
- EAS CLI (`npm i -g eas-cli`)
- Expo CLI (`npm i -g expo-cli`)

## Rodar localmente
```
npm install
npx expo start
```

## Gerar APK pelo Expo (EAS)
```
eas login
eas build -p android --profile preview
```
O link do APK aparecerá no final do build.

## Observações
Este projeto usa serviços públicos (Nominatim/OSRM). Para produção, considere Google Maps / Directions / Distance Matrix com API Key.