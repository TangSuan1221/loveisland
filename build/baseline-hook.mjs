import {registerHooks} from 'node:module';
import fs from 'node:fs';
registerHooks({load(url,context,next){if(url.endsWith('/src/avatar-model.js'))return {format:'module',shortCircuit:true,source:fs.readFileSync('build/avatar-model-before-profile.js','utf8')};return next(url,context)}});
