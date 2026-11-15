import { GameApp } from './app/GameApp';
import { registerServiceWorker } from './platform/Platform';

registerServiceWorker();
void new GameApp().init();
