import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface JuicyButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  scaleTo?: number; // How much it squishes (0.9 is subtle, 0.7 is cartoony)
}

export default function JuicyButton({ children, onPress, style, scaleTo = 0.95 }: JuicyButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    // 1. Physical Haptic Click
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // 2. Squish down instantly
    scale.value = withTiming(scaleTo, { duration: 100 });
  };

  const handlePressOut = () => {
    // 3. Spring back up with a wobble (bouncy physics)
    scale.value = withSpring(1, {
      damping: 10,  // Lower = more wobble
      stiffness: 300 // Higher = faster snap
    });

    // 4. Actually trigger the button action
    if (onPress) {
        // runOnJS is needed because this callback runs on the UI thread by default
        runOnJS(onPress)();
    }
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [style]} // Pass through styles
    >
      <Animated.View style={[animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}