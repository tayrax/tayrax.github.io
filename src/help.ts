// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import './app.css';
import Help from './Help.svelte';

const target = document.getElementById('help');
if (!target) throw new Error('#help root not found');

new Help({ target });
