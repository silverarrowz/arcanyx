import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { theme } from "../../theme";
import PopupSheet from "./PopupSheet";

const BENEFITS = [
  "Расширенные персональные толкования",
  "Дополнительные расклады Таро",
  "История без ограничений",
  "Персональные рекомендации",
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ProModal({ visible, onClose }: Props) {
  return (
    <PopupSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Arcanyx Pro</Text>
      <Text style={styles.subtitle}>
        Больше пространства для глубокого знакомства с собой
      </Text>
      <View style={styles.benefits}>
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={styles.benefit}>
            <View style={styles.benefitCheck}>
              <Check color={theme.colors.gold} size={13} strokeWidth={2} />
            </View>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>
          Оформление подписки скоро появится
        </Text>
      </View>
      <Pressable disabled style={styles.disabledButton}>
        <Text style={styles.disabledButtonText}>Оформить Pro</Text>
      </Pressable>
      <Pressable disabled style={styles.restoreButton}>
        <Text style={styles.restoreText}>Восстановить покупки</Text>
      </Pressable>
    </PopupSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 29,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 310,
    marginTop: 7,
  },
  benefits: {
    alignSelf: "stretch",
    marginTop: 22,
    gap: 13,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitCheck: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,215,154,0.12)",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    marginRight: 11,
  },
  benefitText: {
    flex: 1,
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
  },
  comingSoon: {
    alignSelf: "stretch",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(157,124,230,0.1)",
    marginTop: 23,
  },
  comingSoonText: {
    color: theme.colors.mauve,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    textAlign: "center",
  },
  disabledButton: {
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 12,
  },
  disabledButtonText: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  restoreButton: {
    paddingVertical: 12,
  },
  restoreText: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
  },
});
