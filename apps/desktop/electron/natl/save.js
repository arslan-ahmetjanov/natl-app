'use strict';

const path = require('path');

const { convertTest } = require('./convert');
const store = require('./store');

/**
 * Save a TestBlox scenario as a NATL YAML file in the user's workspace.
 *
 * This is the only place that decides where a scenario lands. The renderer
 * never builds paths: a wrong path in the UI would write a test outside the
 * repository, and that is the one mistake this product must not make.
 */

/** Pages keep elements inside; NATL steps only know selectors. */
function collectElements(pages) {
  const out = [];
  for (const page of pages || []) {
    for (const element of page.webElements || []) {
      if (!element || !element.id) continue;
      out.push({ ...element, pageId: element.pageId || page.id });
    }
  }
  return out;
}

function workspaceRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

/**
 * @param {object} input
 * @param {string} input.root      Workspace root (folder with .testblox/)
 * @param {object} input.test      TestBlox test
 * @param {Array}  [input.actions] Actions catalog
 * @param {Array}  [input.pages]   Pages with webElements
 * @param {string} [input.baseUrl] Start URL override
 * @param {string} [input.fileName] Explicit file name, otherwise derived from the title
 * @param {boolean} [input.overwrite] Rewrite an existing file instead of adding -2
 * @returns {{ filePath: string, relativePath: string, yaml: string, fileName: string, unsupported: Array, overwritten: boolean }}
 */
function saveScenario(input) {
  const { root, test, actions, pages, baseUrl, fileName, overwrite } = input || {};
  if (!root) throw new Error('saveScenario: root is required');
  if (!test) throw new Error('saveScenario: test is required');

  const converted = convertTest({
    test,
    actions,
    elements: collectElements(pages),
    pages,
    baseUrl,
  });

  const dir = store.testsDir(root);
  const existing = store
    .listScenarios(dir)
    .map((file) => path.basename(file));

  const name = fileName
    ? store.scenarioFileName(fileName.replace(/\.ya?ml$/i, ''), overwrite ? [] : existing)
    : store.scenarioFileName(converted.doc.name, overwrite ? [] : existing);

  const filePath = path.join(dir, name);
  const alreadyThere = existing.includes(name);

  store.writeScenario(filePath, converted.yaml);

  return {
    filePath,
    relativePath: workspaceRelative(root, filePath),
    yaml: converted.yaml,
    fileName: name,
    unsupported: converted.unsupported,
    overwritten: alreadyThere,
  };
}

module.exports = { saveScenario, collectElements, workspaceRelative };
