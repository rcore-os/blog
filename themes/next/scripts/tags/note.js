/**
 * note.js | https://theme-next.js.org/docs/tag-plugins/note
 */

/* global hexo */

'use strict';

function postNote(args, content) {
  return `<div class="note ${args.join(' ')}">${hexo.render.renderSync({text: content, engine: 'markdown'})}</div>`;
}

hexo.extend.tag.register('note', postNote, {ends: true});
hexo.extend.tag.register('subnote', postNote, {ends: true});
