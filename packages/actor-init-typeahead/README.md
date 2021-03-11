# TREE+Comunica Typeahead

TREE+Comunica Typeahead is a query engine for realtime text search over decentralized RDF datasets.

Internally, this is a [Comunica module](https://comunica.dev/) based on [Comunica SPARQL](https://github.com/comunica/comunica/tree/master/packages/actor-init-sparql), and can likewise be configured with additional modules.

## Command Line Utilities

If you have installed this project as described on [Github sources](https://github.com/TREEcg/treemunica), you can test this actor, or its configuration files, using the `bin/run.js`and `bin/run-dynamic.js` scripts. The `bin/run.js` script uses the preconfigured actor at `engine-default.js`, which gets created while installing the project (see the prepare script in `package.json`). The other script interprets the configuration file at runtime, making it more suitable for testing configurations.

For example, running `bin/run.js https://treecg.github.io/demo_data/cht.nt aarde nederland` will use the default configuration to search for the terms 'aarde' and 'nederland' in a TREE collection that is hosted at https://treecg.github.io/demo_data/cht.nt. Running this should yield this output:

````
# Discovered TREE nodes: 135
[1]
  Subject: https://data.cultureelerfgoed.nl/term/id/cht/d9121f36-5c7e-49ea-8d40-08521f7f8c2b
  # Matching Quads: 1
  Score:   [2,12,-52]
    http://www.w3.org/1999/02/22-rdf-syntax-ns#type
      https://data.cultureelerfgoed.nl/vocab/id/rce#Source
    http://purl.org/dc/terms/created
      2016-09-29T11:46:57Z
    https://data.cultureelerfgoed.nl/vocab/id/rce#isSourceOf
      https://data.cultureelerfgoed.nl/term/id/cht/7be94ac2-6e3f-4f4c-ada2-36f1cbc50457
    http://www.w3.org/2004/02/skos/core#prefLabel
      Bewogen aarde, aardkundig erfgoed in Nederland, 2007
    https://data.cultureelerfgoed.nl/vocab/id/rce#isSourceOf
      https://data.cultureelerfgoed.nl/term/id/cht/078b8a8e-0437-4b06-b498-95b0f0ef41ba
    http://www.w3.org/1999/02/22-rdf-syntax-ns#type
      http://www.w3.org/2004/02/skos/core#Concept
    http://www.w3.org/2004/02/skos/core#broader
      https://data.cultureelerfgoed.nl/term/id/cht/f772d0b1-5828-4786-b77f-37eabc8c19f4
    http://purl.org/dc/terms/creator
      https://cultureelerfgoed.poolparty.biz/user/moutp
    https://data.cultureelerfgoed.nl/vocab/id/rce#hasConceptStatus
      https://data.cultureelerfgoed.nl/term/id/cht/c58475d5-0795-4623-b4be-ea1524f4b4fb
    https://data.cultureelerfgoed.nl/vocab/id/rce#isSourceOf
      https://data.cultureelerfgoed.nl/term/id/cht/b2c54b42-bdc5-4542-9c77-a4e626a7d450
    http://www.w3.org/2004/02/skos/core#inScheme
      https://data.cultureelerfgoed.nl/term/id/cht/7ca1a6b4-85ce-4244-a097-0ad177b5575c
    https://data.cultureelerfgoed.nl/vocab/id/rce#isSourceOf
      https://data.cultureelerfgoed.nl/term/id/cht/0e3a026d-e227-4295-a1a6-0a7af073801b
    https://data.cultureelerfgoed.nl/vocab/id/rce#isSourceOf
      https://data.cultureelerfgoed.nl/term/id/cht/f4e9eec3-2f0e-4682-adf6-82ef8224dc59
    http://schema.semantic-web.at/ppt/inSubtree
      https://data.cultureelerfgoed.nl/term/id/cht/f772d0b1-5828-4786-b77f-37eabc8c19f4
````

All quads related to the matched subject are returned, while the only the fourth quad matches the input.

## Usage within other applications

This package has been developed and tested on Linux and macOS, on Node.JS version 14.

To use this library within your own Javascript project, install it from NPM as follows: 

```bash
$ npm i @treecg/actor-init-typeahead
```

You can then create a query engine (with default engine) as follows:

```javascript
const newEngine = require('@treecg/actor-init-typeahead').newEngine;
const myEngine = newEngine();
```

An engine may also be created dynamically from a custom configuration file:

```javascript
const newEngineDynamic = require('@treecg/actor-init-typeahead').newEngineDynamic;
const myEngine = await newEngineDynamic({ configResourceUrl: 'path/to/config.json' });
```

Alternatively, to use a static version of a custom configuration we recommend to create an NPM script:

```javascript
"scripts": {
    "prepare": "comunica-compile-config cpath/to/config.json urn:comunica:typeaheadinit > comunica-engine.js"
}
```

Running `npm run prepare` will then create a `comunica-engine.js` file which can be used as:

```javascript
const myEngine = require('comunica-engine');
```

Once you have an engine, you can use it to query the Web as follows:

```javascript
const expectedPredicateValues = {
    'http://www.w3.org/2004/02/skos/core#prefLabel': ['aarde', 'nederland'],
    'http://www.w3.org/2004/02/skos/core#altLabel': ['aarde', 'nederland'],
}

const query = {
    numResults: 5,
    urls: ['https://treecg.github.io/demo_data/cht.nt'],
    treeNodes: [],
    expectedDatatypeValues: {},
    expectedPredicateValues,
};

const results = engine.query(query);
results.on('data', d => {
    console.log(JSON.stringify(d));
});
```

The return value of the query method is an AsyncIterator, which may be consumed by subscribing to any 'data' events it emits. Each data event contains an IResult object, defined as: 

```javascript
import type * as RDF from 'rdf-js';

interface IResult {
  knownTreeNodes: ITreeNode[];
  rankedSubjects: IRankedSubject[];
}

interface ITreeNode {
  url: string;
  values: TreeValues;
}

interface IRankedSubject {
  score: number[];
  subject: string;
  matchingQuads: RDF.Quad[];
  quads: RDF.Quad[];
}
```

The returned TREE nodes can be passed on to subsequent query calls, so that not every query has to restart from the collection roots.

## Configuration

Like all Comunica modules, this actor can be configured through [Components.js](https://componentsjs.readthedocs.io/en/latest/). After getting acquainted with this framework, you can start making changes to the configuration files in `config/`. 

For example, if you want to add an additional metric for ranking the found results, have a look at `config/sets/rdf-score.jsonld`. At the moment this file specifies that three actors are used, with their order set using the `beforeActor` property. 

To test these any changes, either rebuild the `engine-default.js` file by running `npm run prepare`, or by using the `bin/run-dynamic.js` script. 

## Recipes

To use this actor in a real application, here are a few patterns you might want to reuse.

### Close running iterators when a new query is fired

Keep track of the current results iterator, and close it before starting a new one:

```javascript
iterator.removeAllListeners();
iterator.close();
```

This will stop the running query from traversing any further data pages.

### Reuse discovered tree nodes

```javascript
let nodes = null;

function query(...) {
    const query = {
        numResults,
        urls: roots,
        treeNodes: nodes,
        expectedDatatypeValues,
        expectedPredicateValues,
      };

    iterator = engine.query(query);
    iterator.on('data', d => {
        nodes = d.knownTreeNodes;
    }
}
```

This will make subsequent queries more efficient, as it will reuse the discovered tree nodes to bootstrap the node traversal.

### Prefetch the dataset roots

Related to the previous point, you can parse the root nodes on page load:

```
let nodes = null;
function prefetch(urls) {
    engine.prefetch(urls).then((discoveredNodes) => {
        nodes = discoveredNodes;
    })
}
```

The query engine exposes a `prefetch` method that only returns the discovered nodes on the specified root URLs.

### Normalize your input

Literal normalization actors can be configured to improve the recall, but this only works if the input is normalized in the same way as the found results. The engine exposes a `normalizeInput` method for this reason, which can be used to normalize a list of search terms to a list of normalized terms:

```
const normalizedInput = await engine.normalizeInput(['belgië']);

const expectedPredicateValues = {
    'http://www.w3.org/2004/02/skos/core#prefLabel': normalizedInput,
    'http://www.w3.org/2004/02/skos/core#altLabel': normalizedInput,
}
```

### Use a Webworker per data source

Processing a lot of RDF data freeze your web page, so it's a good idea to use a Webworker in any case. But especially if you're querying over multiple datasets, as these can be handled in parallel. Each results object also specifies the scores the result received, so the results from different data sources can be recombined in the main thread. For example of how this can be implemented, see our [demo code](https://github.com/TREEcg/treemunica_typeahead_demo).


