import React from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View as NativeView,
  type TextProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { translateSource } from './engine';
import { useLanguage } from './LanguageProvider';

export function Text({ children, style, ...props }: TextProps) {
  const { textStyle, language } = useLanguage();
  const translate = (child: React.ReactNode): React.ReactNode =>
    typeof child === 'string'
      ? translateSource(child)
      : Array.isArray(child)
      ? child.map(translate)
      : child;
  return (
    <NativeText
      {...props}
      style={[
        style,
        language.code !== 'en' && { fontFamily: language.font },
        {
          writingDirection: textStyle.writingDirection,
          textAlign: textStyle.textAlign,
        },
        language.script === 'Arab' && styles.arabicText,
      ]}
    >
      {translate(children)}
    </NativeText>
  );
}

export function TextInput({ style, placeholder, ...props }: TextInputProps) {
  const { textStyle, language } = useLanguage();
  return (
    <NativeTextInput
      {...props}
      placeholder={placeholder ? translateSource(placeholder) : placeholder}
      style={[
        style,
        language.code !== 'en' && { fontFamily: language.font },
        {
          textAlign: textStyle.textAlign,
          writingDirection: textStyle.writingDirection,
        },
      ]}
    />
  );
}

export function View({ style, ...props }: ViewProps) {
  const { rtl } = useLanguage();
  return (
    <NativeView
      {...props}
      style={[style, rtl ? styles.rtl : styles.ltr]}
    />
  );
}

const styles = StyleSheet.create({
  arabicText: {lineHeight:undefined,paddingVertical:5},
  rtl: {direction:'rtl'},
  ltr: {direction:'ltr'},
});
