import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App)
// y además deja el entorno bien montado, tanto en Expo Go como en un build
// nativo.
registerRootComponent(App);
