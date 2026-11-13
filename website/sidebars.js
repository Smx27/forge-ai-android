/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
module.exports = {
  docs: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Using Forge',
      collapsed: false,
      items: ['chat-and-agent', 'models', 'linux', 'files', 'projects-git-backup', 'skills-and-connectors', 'settings'],
    },
    'troubleshooting',
    {type: 'category', label: 'Developers', items: ['publishing']},
  ],
};
