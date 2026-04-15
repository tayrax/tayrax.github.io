// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import './app.css';
import Logs from './Logs.svelte';

const target = document.getElementById('logs');
if (!target) throw new Error('#logs root not found');

new Logs({ target });
