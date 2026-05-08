import React from 'react';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '../theme';

const SIZE = 22;
const stroke = colors.accentBright;
const sw = 1.4;

export const PersonIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={stroke} strokeWidth={sw} />
    <Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </Svg>
);

export const SchoolIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Path d="M2 9l10-5 10 5-10 5L2 9z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    <Path d="M6 11v5c2 1.5 4 2 6 2s4-.5 6-2v-5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </Svg>
);

export const TargetIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} />
    <Circle cx="12" cy="12" r="5" stroke={stroke} strokeWidth={sw} />
    <Circle cx="12" cy="12" r="1.5" fill={stroke} />
  </Svg>
);

export const BoltIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
  </Svg>
);

export const GlassIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Path d="M6 3h12l-1 8a5 5 0 01-10 0L6 3z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    <Line x1="12" y1="16" x2="12" y2="21" stroke={stroke} strokeWidth={sw} />
    <Line x1="8" y1="21" x2="16" y2="21" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </Svg>
);

export const HeartBreakIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Path d="M12 21s-8-5.5-8-11a5 5 0 019-3 5 5 0 019 3c0 5.5-8 11-8 11z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    <Polyline points="10,8 13,11 10,14 13,17" stroke={stroke} strokeWidth={sw} fill="none" />
  </Svg>
);

export const AtomIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="2" fill={stroke} />
    <Path d="M3 12c0-3 4-5 9-5s9 2 9 5-4 5-9 5-9-2-9-5z" stroke={stroke} strokeWidth={sw} />
    <Path d="M7 4c2.5 0 4.5 4 4.5 8s-2 8-4.5 8" stroke={stroke} strokeWidth={sw} fill="none" transform="rotate(45 12 12)" />
  </Svg>
);

export const SleepIcon = () => (
  <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} />
    <Path d="M9 14c1 1 2 1.5 3 1.5s2-.5 3-1.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    <Circle cx="9" cy="10" r="0.8" fill={stroke} />
    <Circle cx="15" cy="10" r="0.8" fill={stroke} />
    <Path d="M14 5l3 0-3 3 3 0" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" fill="none" />
  </Svg>
);

// Map trigger key → icon component
export const triggerIcons = {
  'phone': TargetIcon,
  'food': BoltIcon,
  'alcohol': GlassIcon,
  'relationships': HeartBreakIcon,
  'work': SchoolIcon,
  'overthinking': AtomIcon,
  'sleep': SleepIcon,
  'mom': PersonIcon,
  'school': SchoolIcon,
};

export function IconFor({ trigger, size }) {
  const key = (trigger || '').toLowerCase();
  let Cmp = triggerIcons.phone;
  for (const k of Object.keys(triggerIcons)) {
    if (key.includes(k)) { Cmp = triggerIcons[k]; break; }
  }
  return <Cmp />;
}
