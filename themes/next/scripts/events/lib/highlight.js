const fs = require('fs');
const path = require('path');

function resolve(package) {
  return path.dirname(require.resolve(`${package}/package.json`));
}

function highlightTheme(name) {
  let file = `${resolve('highlight.js')}/styles/${name}.css`;
  let css = fs.readFileSync(file).toString();
  let rule = '';
  let background = '';
  let foreground = '';
  css.replace(/\.hljs(\s+|,[^{]+)\{(.*?)\}/sg, (match, $1, content) => {
    rule += content;
    return match;
  });
  rule.split('\n').forEach(line => {
    if (line.includes('background:')) background = line.split('background:')[1];
    else if (line.includes('background-color:')) background = line.split('background-color:')[1];
    else if (line.includes('color:')) foreground = line.split('color:')[1];
  });
  return {
    file,
    background,
    foreground
  };
}

function prismTheme(name) {
  let file = `${resolve('prismjs')}/themes/${name}.css`;
  if (!fs.existsSync(file)) file = `${resolve('prism-themes')}/themes/${name}.css`;
  return file;
}

module.exports = hexo => {
  let { config } = hexo;
  let theme = hexo.theme.config;
  config.highlight.hljs = false;
  config.prismjs = config.prismjs || {};
  theme.highlight = {
    enable: config.highlight.enable && !config.prismjs.enable,
    light : highlightTheme(theme.codeblock.theme.light),
    dark  : highlightTheme(theme.codeblock.theme.dark)
  };
  theme.prism = {
    enable: config.prismjs.enable,
    light : prismTheme(theme.codeblock.prism.light),
    dark  : prismTheme(theme.codeblock.prism.dark),
    number: `${resolve('prismjs')}/plugins/line-numbers/prism-line-numbers.css`
  };
};
