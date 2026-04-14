// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import './app.css';
import System from './System.svelte';

const target = document.getElementById('system');
if (!target) throw new Error('#system root not found');

new System({ target });
