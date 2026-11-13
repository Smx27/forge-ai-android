// Edit these two values for your release. Everything else on the site reads from here.
module.exports = {
  // Your Play Store listing. Keep it as-is if the package name stays com.forge.app.
  playStoreUrl: process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.forge.app',
  // owner/repo on GitHub. In GitHub Actions this is filled in automatically.
  githubRepo: process.env.GITHUB_REPOSITORY || 'your-username/forge',
};
