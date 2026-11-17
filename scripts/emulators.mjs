#!/usr/bin/env node
// Start the Firebase Auth + Firestore emulators with Java 21.
// (On this machine JAVA_HOME points at Java 11, which the emulators reject.)
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const env = { ...process.env };
const adoptium = 'C:\\Program Files\\Eclipse Adoptium';
if (existsSync(adoptium)) {
  const jdk21 = readdirSync(adoptium).filter(d => d.startsWith('jdk-21')).sort().pop();
  if (jdk21) {
    env.JAVA_HOME = join(adoptium, jdk21);
    env.PATH = `${join(env.JAVA_HOME, 'bin')};${env.PATH}`;
  }
}

const child = spawn('npx', ['-y', 'firebase-tools@latest', 'emulators:start', '--only', 'auth,firestore', '--project', 'dance-class-companion'], {
  env,
  stdio: 'inherit',
  shell: true,
});
child.on('exit', code => process.exit(code ?? 0));
