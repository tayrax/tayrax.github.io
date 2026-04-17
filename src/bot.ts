// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import './app.css';
import Bot from './Bot.svelte';

const target = document.getElementById('bot');
if (!target) throw new Error('#bot root not found');

new Bot({ target });
