import createIconSet from '@expo/vector-icons/createIconSet';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

export const Ionicons = createIconSet(
  glyphMap,
  'ionicons',
  require('../../../assets/fonts/Ionicons.ttf'),
);

export type IoniconName = keyof typeof glyphMap;
