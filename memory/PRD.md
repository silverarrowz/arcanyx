# Mystic Oracle — Mobile App (Expo)

## Overview
A Russian-language mystical/esoteric assistant mobile app built with React Native + Expo + Reanimated. Dark cosmic aesthetic with glassmorphism, gold (#D4AF37) and neon-purple (#9D4EDD) accents on midnight-black (#0D0E15).

## Architecture
- **Routing:** expo-router with `app/(tabs)/_layout.tsx` providing 4 bottom tabs.
- **State:** React Context (`HistoryContext`) + AsyncStorage for persistent local history. No backend.
- **Fonts:** Cormorant Garamond (decorative serif headings) + Manrope (UI body).
- **Animations:** react-native-reanimated for the 3D card flip, oracle orb breathing/pulse, and list entrance animations.

## Features
### 1. Home tab (Сегодня)
- Header "Звёзды благосклонны" + streak badge.
- Energy of the Day glass card with daily phrase (deterministic by date).
- Interactive flippable Tarot Card of the Day (3D rotateY) — saves to Diary on first flip per day.
- Sign of the Day widget.

### 2. Oracle tab (Оракул)
- Input "Задай вопрос Вселенной…", glowing breathing orb, "Узнать ответ" button.
- 2-second mystical loading pulse.
- Random answer from 4 categories (Yes / No / Vague / Snarky) with colored category badge.
- Auto-saves question + answer to Diary.

### 3. Tarot tab (Таро)
- Fanned spread of 5 face-down cards from a 10-card Major Arcana deck.
- Tap one → flip animation → name + short meaning + detailed interpretation.
- "Моё толкование" modal lets user record intuition before reading.
- "Новый расклад" reshuffles.

### 4. Diary tab (Дневник Судьбы)
- FlatList of all past Oracle/Tarot interactions (newest first).
- 3 seeded dummy items on first launch.
- Each Oracle item has "Сбылось" / "Не сбылось" toggle buttons that highlight green/red and persist.

## Tech stack
- expo SDK 54, expo-router 6, react-native 0.81, react-native-reanimated 4
- @react-native-async-storage/async-storage, expo-blur, expo-linear-gradient, expo-haptics
- lucide-react-native for icons, @expo-google-fonts/* for typography

## Smart business enhancement
The streak counter on the Home tab gamifies daily engagement — encouraging users to return every day to maintain their "magical streak". This pattern reliably boosts retention and lays the groundwork for future monetization (premium spreads, AI interpretations, themed card decks).

## Future / deferred
- Server sync (MongoDB) for cross-device history
- AI-generated personalised interpretations (Claude / GPT via Emergent LLM key)
- Custom AI-generated card art (Nano Banana)
- Daily push notifications
