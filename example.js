var fs = require("fs");
var colorExtractor = require("./css_color_extractor.js");


fs.readFile("./test_css/test.css", "utf8", function (err,data) {
  if (err) {
    return console.log(err);
  }
  finalRulesets = colorExtractor.extractCss(data, console.log); //This is as far as I've gotten
  
});
