module.exports = {
  presets: [require('../../packages/admin-kit/tailwind.preset.cjs')],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/admin-kit/src/**/*.{ts,tsx}'],
};
