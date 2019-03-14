module.exports = {
  "root": true,
  "parser": "babel-eslint",
  "env": {
      "es6": true,
      "node": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
      "sourceType": "module"
  },
  "rules": {
      "quotes": [ "error", "single" ],
      "semi": [ "error", "always" ],
      "no-unused-vars": 0,
      "no-console": 0
  }
};
