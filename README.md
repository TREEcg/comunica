<p align="center">
  <a href="https://treecg.github.io/specification/">
    <img alt="TREE" src="https://raw.githubusercontent.com/TREEcg/specification/master/tree-logo.svg" height="200">
  </a>
  <a href="https://comunica.dev/">
    <img alt="Comunica" src="https://comunica.dev/img/comunica_red.svg" height="200">
  </a>
</p>

<p align="center">
  <strong>A blend of Comunica and TREE, the finest ingredients for querying a decentralized Web</strong>
</p>

**[Learn more about Comunica on the comunica.dev](https://comunica.dev/).**

**[Read the TREE specification at treecg.github.io/specification](https://treecg.github.io/specification/).**

# Overview

This is a fork of the Comunica framework, so that most of Comunica's documentation can be applied to this project as well. The main difference is the scope of the two projects; whereas Comunica focuses on querying Knowledge Graphs, this fork focuses on utilizing the TREE hypermedia specification for usecases such as autocompletion and tracking evolving datasets.

## Components

### ActorInitTypeahead

[This actor has its own documentation](https://github.com/TREEcg/treemunica/tree/master/packages/actor-init-typeahead).

### ActorRdfScore

Some usecases require the ordering of all found results, often because only a fixed small amount of results will be shown to the end-user. These actors score a single RDF quad to `{ [-Inf, +Inf] ∪ {null} }`, where +Inf signifies the best possible score, and -Inf signifies the worst possible score. `null` indicates the actor could not score this quad. These scores have a partial ordering, where the `null` score is incomparable to any other score. 

A single score will often be insufficient as additional scores are needed to break ties. For example, it may be desirable to first order by the length of the common substring, followed by the length of the found string. Sequences of scores can be ordered as well, where `(a,b) ≤ (a′,b′) if and only if a < a′ or (¬(a' < a') and b ≤ b′)` . 

The Action object given to these actors contains the RDF quad that needs to be scored, and an optional `literalValue` property that indicates that the quad's object is to be interpreted as this literal -- presumably because it has been normalized. The action also specifies which values are being searched for, either by specifying the expected values for a specific predicate, or as the expected values for a datatype as a whole. These expected values share the same Typescript definition: `type IExpectedValues = Record<string, any[]>;`, where the Record's keys are URIs and the values may be any Javascript value. It is the actor's responsibility to decide which of the specified values to compare to the quad, or to return `null` if the actor is unable to score this quad at all.

The following actors are currently implemented:

* **ActorRdfScoreBigram**: Counts how many bigrams of the expected values can be found in the scored quad's literal. Returns `null` if the quad's object is not a `xsd:string` or `xsd:langString`.
* **ActorRdfScoreCommonPrefix**: Returns the length of the longest common prefix between the expected values and the quad's literal value, or `null` if the quad's object is not a `xsd:string` or `xsd:langString`.
* **ActorRdfScoreExactPrefix**: Like the above, but returns `-Inf` if the none of the expected values are a prefix of the quad's value(s).
* **ActorRdfScoreStringLength**: As the name implies, simply returns the length of the string.

### ActorTreeScore

Like the ActorRdfScore, but for TREE relations and their specified values. There are two differences though:

* The Action object only contains a `values` and an `expectedValues` value, which both share this type definition: `type TreeValues = Record<string, RDF.Literal[]>`. The key in this record type is the URI of a TREE relation class (e.g., `tree:SubstringRelation`), and the values are the objects of the `tree:value` properties. 

* These scores are not used to order already discovered quads. Instead, they are used to prioritize TREE relations to discover those quads as quickly as possible. The `expectedValues` property indicates which TREE nodes we _want_ to reach, without knowing whether or not this is possible. 

The following actors are currently implemented:

* **ActorTreeScoreExactPrefix**: This actor will return the length of the common prefix between the expeced value and the found value, or `-Inf` if the found value is not a prefix of the expected value. This is similar to the ActorRdfScoreExactPrefix, except that the roles of the expected and found values are reversed. 

### ActorRdfMetadataExtractTree

Wraps the existing [TREE metadata extraction](https://github.com/Dexagod/tree-metadata-extraction) library in a Comunica actor, and is used alongside the Comunica's existing metadata extraction actors.

### ActorRdfResolveHypermediaLinksTreeAll

Takes the extracted hypermedia data, preferably from ActorRdfMetadataExtractTree, and extracts a list of all discovered hypermedia links.

### ActorLiteralNormalize

Normalization is a common preprocessing in information retrieval systems to improve the system's recall by making it less sensitive to the various ways of encoding the same information in a literal value. in TREEmunica we provide a base class for normalizing literals, and subclasses of this class communicate which datatypes they can normalize. 
We currently provide a single implementation that normalizes all `xsd:string` and `xsd:langString` literals to  [NFKD](http://www.unicode.org/reports/tr15/#Normalization_Forms_Table), and then discards all codepoints that aren't in the Letter (L), number (N), or Separator (Z) categories. 

## Development Setup

This repository is a fork of the [Comunica repository](https://github.com/comunica/), and is likewise managed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md) using [Lerna](https://lernajs.io/). The project can be setup by cloning and installing it as follows:

```bash
$ git clone https://github.com/TREEcg/treemunica.git
$ cd comunica
$ yarn install
```

**Note: `npm install` is not supported at the moment, as this project makes use of Yarn's [workspaces](https://yarnpkg.com/lang/en/docs/workspaces/) functionality**

This will install the dependencies of all modules, and bootstrap the Lerna monorepo. After that, all [Comunica packages](https://github.com/comunica/comunica/tree/master/packages) are available in the `packages/` folder and can be used in a development environment.

Furthermore, this will add [pre-commit hooks](https://www.npmjs.com/package/pre-commit) to build, lint and test. These hooks can temporarily be disabled at your own risk by adding the `-n` flag to the commit command.

## Cite

If you are using or extending Comunica as part of a scientific publication,
we would appreciate a citation of our [article](https://comunica.github.io/Article-ISWC2018-Resource/).

```bibtex
@inproceedings{taelman_iswc_resources_comunica_2018,
  author    = {Taelman, Ruben and Van Herwegen, Joachim and Vander Sande, Miel and Verborgh, Ruben},
  title     = {Comunica: a Modular SPARQL Query Engine for the Web},
  booktitle = {Proceedings of the 17th International Semantic Web Conference},
  year      = {2018},
  month     = oct,
  url       = {https://comunica.github.io/Article-ISWC2018-Resource/}
}
```

## License
This code is copyrighted by [Ghent University – imec](http://idlab.ugent.be/)
and released under the [MIT license](http://opensource.org/licenses/MIT).
