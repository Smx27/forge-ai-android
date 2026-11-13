import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';

const FEATURES = [
  {
    tag: '01 // AGENT',
    title: 'An agent that finishes the job',
    body: 'Forge plans the work, writes real files, runs them and checks the result. You approve risky steps, see every tool call, and can undo any change.',
    shot: 'chat-approval.jpg',
    link: '/docs/chat-and-agent',
  },
  {
    tag: '02 // LINUX',
    title: 'A real Linux shell in your pocket',
    body: 'One tap installs Alpine Linux with a verified checksum. Node.js, Python, git and thousands of packages, no root needed. The agent uses the same shell.',
    shot: 'terminal.jpg',
    link: '/docs/linux',
  },
  {
    tag: '03 // MODELS',
    title: 'Free cloud models or fully offline',
    body: 'Bring a free key from OpenRouter, Gemini, Groq, NVIDIA, Cerebras, Mistral, Hugging Face or GitHub Models, point it at your own server, or run a model on the phone with no internet at all.',
    shot: 'model-picker.jpg',
    link: '/docs/models',
  },
  {
    tag: '04 // FILES',
    title: 'Build it, then open it',
    body: 'A shared workspace for you and the agent. Edit files, preview HTML instantly, start a dev server and see the live app, or export the project as a zip.',
    shot: 'live-preview.jpg',
    link: '/docs/files',
  },
  {
    tag: '05 // SKILLS',
    title: 'Teach it new tricks',
    body: 'Install skills from GitHub and connect MCP servers to give the agent new knowledge and tools. Clone, commit and push with GitHub built in.',
    shot: 'store-skills.jpg',
    link: '/docs/skills-and-connectors',
  },
  {
    tag: '06 // USAGE',
    title: 'Know what every answer costs',
    body: 'Tokens, requests, response times and models per day, a daily budget, and automatic fallback to another provider when one hits a rate limit.',
    shot: 'usage.jpg',
    link: '/docs/projects-git-backup',
  },
];

const STATS = [
  ['8', 'Free cloud providers'],
  ['0', 'Accounts or trackers'],
  ['AES-256', 'Keys and data encrypted'],
  ['100%', 'Open source'],
];

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M4 2.6v18.8c0 .5.5.8.9.6l16-9.4a.7.7 0 0 0 0-1.2l-16-9.4A.6.6 0 0 0 4 2.6z" />
    </svg>
  );
}

function Phone({src, alt, className}) {
  return (
    <div className={[styles.phone, className].filter(Boolean).join(' ')}>
      <img src={useBaseUrl('/img/shots/' + src)} alt={alt} loading="lazy" />
    </div>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  const {playStoreUrl, repoUrl} = siteConfig.customFields;
  return (
    <Layout title="AI engineer for Android" description={siteConfig.tagline}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <div className={styles.addr}><span className={styles.dot} />FORGE://ANDROID · v1.0</div>
            <h1 className={styles.title}>Build with AI,<br />wherever you are.</h1>
            <p className={styles.lead}>
              Forge is an AI engineer that lives on your phone. It writes and edits real files, runs them in a real
              Linux shell, searches the web and learns new skills. Free cloud models or a private on-device model.
              Your keys and files stay on the phone.
            </p>
            <div className={styles.ctas}>
              <a className={styles.play} href={playStoreUrl}>
                <PlayIcon />
                <span><small>GET IT ON</small>Google Play</span>
              </a>
              <Link className={styles.ghost} to="/docs">Read the docs</Link>
              <a className={styles.ghost} href={repoUrl}>Source on GitHub</a>
            </div>
          </div>
          <div className={styles.heroShots}>
            <Phone src="welcome.jpg" alt="Welcome screen" className={styles.back} />
            <Phone src="chat-result.jpg" alt="Agent result" className={styles.front} />
          </div>
        </section>

        <section className={styles.stats}>
          {STATS.map(([value, label]) => (
            <div key={label} className={styles.stat}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className={styles.features}>
          {FEATURES.map((f, i) => (
            <article key={f.tag} className={[styles.feature, i % 2 ? styles.flip : ''].join(' ')}>
              <div className={styles.featureText}>
                <div className={styles.sect}>{f.tag}</div>
                <h2>{f.title}</h2>
                <p>{f.body}</p>
                <Link to={f.link} className={styles.more}>Learn more ›</Link>
              </div>
              <Phone src={f.shot} alt={f.title} />
            </article>
          ))}
        </section>

        <section className={styles.privacy}>
          <div className={styles.sect}>// PRIVATE BY DESIGN</div>
          <h2>Nothing goes to us. Ever.</h2>
          <div className={styles.grid}>
            <div className={styles.panel}><h3>No accounts</h3><p>No sign-up, no analytics, no ads and no tracking SDKs. We run no servers that see your content.</p></div>
            <div className={styles.panel}><h3>Encrypted on device</h3><p>API keys, chats and settings are encrypted with keys held in Android Keystore. Backups use your own password.</p></div>
            <div className={styles.panel}><h3>You choose the provider</h3><p>Messages go only to the model provider you picked with your own key, or nowhere at all with on-device models.</p></div>
          </div>
          <Link to="/privacy" className={styles.more}>Read the privacy policy ›</Link>
        </section>

        <section className={styles.final}>
          <h2>Your phone is now a dev machine.</h2>
          <div className={styles.ctas}>
            <a className={styles.play} href={playStoreUrl}>
              <PlayIcon />
              <span><small>GET IT ON</small>Google Play</span>
            </a>
            <Link className={styles.ghost} to="/docs/getting-started">Getting started</Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
