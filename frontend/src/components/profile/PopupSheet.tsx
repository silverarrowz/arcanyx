import React, { useEffect, useState } from "react";
import {
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import GoldSheetRim from "./GoldSheetRim";

const POPUP_BG = require("../../../assets/home/bg-popup.jpg");
const SHEET_RADIUS = 30;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function PopupSheet({ visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [sheetWidth, setSheetWidth] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const sheetY = useSharedValue(56);

  useEffect(() => {
    if (!visible) {
      sheetY.value = 56;
      setKeyboardHeight(0);
      return;
    }
    sheetY.value = 56;
    sheetY.value = withTiming(0, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, sheetY]);

  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const onSheetLayout = (event: LayoutChangeEvent) => {
    setSheetWidth(event.nativeEvent.layout.width);
  };

  const keyboardLift = Platform.OS === "ios" ? keyboardHeight : 0;
  const sheetMaxHeight = Math.max(280, windowHeight - keyboardLift - 24);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingBottom: keyboardLift }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? undefined : "height"}
          style={styles.sheetAvoid}
        >
          <Animated.View
            style={[
              styles.sheetWrap,
              sheetAnimStyle,
              keyboardLift > 0
                ? { height: sheetMaxHeight }
                : { maxHeight: sheetMaxHeight },
            ]}
          >
            <ImageBackground
              source={POPUP_BG}
              style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, 20) + 16 },
              ]}
              imageStyle={styles.bgImage}
              resizeMode="cover"
              onLayout={onSheetLayout}
            >
              <GoldSheetRim
                width={sheetWidth}
                radius={SHEET_RADIUS}
                idPrefix="popupRim"
              />
              <View style={styles.scrim} pointerEvents="none" />
              <View style={styles.handle} />
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <X color="#7C7696" size={22} />
              </Pressable>
              <View style={styles.body}>{children}</View>
            </ImageBackground>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10,8,20,0.75)",
  },
  sheetAvoid: {
    width: "100%",
  },
  sheetWrap: {
    width: "100%",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: "hidden",
    backgroundColor: "#121022",
  },
  sheet: {
    backgroundColor: "#121022",
    paddingHorizontal: 24,
    paddingTop: 10,
    flexGrow: 1,
    maxHeight: "100%",
  },
  bgImage: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12, 10, 24, 0.18)",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 8,
    zIndex: 1,
  },
  closeButton: {
    position: "absolute",
    top: 18,
    right: 18,
    zIndex: 4,
    padding: 4,
  },
  body: {
    alignItems: "center",
    paddingTop: 12,
    zIndex: 1,
    flexGrow: 1,
    flexShrink: 1,
    alignSelf: "stretch",
  },
});
