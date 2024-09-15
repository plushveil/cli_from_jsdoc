# CLI from JSDoc

Create a CLI from a JSDoc annotated JavaScript file


## Installation

```bash
npm install -g cli_from_jsdoc
```


## Usage

Add the following to your `package.json`:

```json
{
  "bin": {
    "<command name>": "npx @plushveil/cli_from_jsdoc"
  }
}
```

The `cli_from_jsdoc` executable will look for a package.json in the given directory and generate a CLI based on the JSDoc comments in the `main` file.
