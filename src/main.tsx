import {render} from 'preact';
import {App} from './app';
import {applyTokens} from './theme/tokens';
// Static Inter weights: variable fonts need Chrome 62, webOS 4 has Chrome 53.
import '@fontsource/inter/latin-200.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './theme/global.css';

applyTokens();
render(<App />, document.getElementById('root')!);
