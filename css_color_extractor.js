var jscssp = require('./lib/jscssp');
var stringifyObject = require('stringify-object');
var css = require('css');

var ruleTypes = {
	style: 1,
	charset: 2,
	"import": 3,
	media: 4,
	fontface: 5,
	page: 6,
	keyframes: 7,
	keyframe: 8,
	namespace: 100,
	comment: 101,
	whitespace: 102,
	variables: 200,
	declaration: 1000,
	unknown: 0
};

var supportedRuleTypes = [ruleTypes.style, ruleTypes.media];

//Pass these in?
var lookupRules = ["color"];
var excludedRules = ["-moz-initial", "transparent"];

function extractCss(styleSheetText, callback){
	var parser = new jscssp.CSSParser();
	var normalizeStyleSheetText = normalizeStyleSheet(styleSheetText);
	var styleSheet = parser.parse(normalizeStyleSheetText, false, true);
	//prettyPrint(styleSheet);
	
	var cssRules = styleSheet.cssRules;
	var finalRulesets = [];
	var currentRulesetIndex = 0;
	var lastRuleType;
	var lastMediaValue;
	for(var ruleIndex=0, ruleIndexMax=cssRules.length; ruleIndex<ruleIndexMax; ruleIndex++){
		var cssRule = cssRules[ruleIndex];
		var ruleType = cssRule.type;
		var media = extractMedia(cssRule.media);
		var isSupportedType = inArray(ruleType, supportedRuleTypes);

		if(isSupportedType){
		
			if(lastMediaValue != media){
				if(ruleIndex != 0) currentRulesetIndex += 1;
				finalRulesets[currentRulesetIndex] = new StyleRuleSet(media);
			}
			
			addStyleRule(cssRule, finalRulesets[currentRulesetIndex]);
			lastRuleType = ruleType;
			lastMediaValue = media;
		}
	}
	
	var cssText = stringifyRulesets(finalRulesets);
	
	if (typeof(callback) == "function"){
		callback(cssText);
	}
	else{
		return cssText;
	}
}

function stringifyRulesets(finalRulesets){
	var cssText = "";
	for(var fri=0, friMax = finalRulesets.length; fri < friMax; fri++){
		var result = finalRulesets[fri];
		cssText += result.stringify();
	}
	cssText = normalizeStyleSheet(cssText);
	return cssText;
}

function normalizeStyleSheet(styleSheetText){
	var obj = css.parse(styleSheetText);
	var normalizedText = css.stringify(obj);
	return normalizedText;
}

function extractMedia(media){
	if(media && media.length != 0){
		return media[0];
	}
	return "";
}

function addStyleRule(cssRule, currentRuleset){
	
	var allRules;
	
	if(cssRule.declarations !== undefined) {
		allRules = [cssRule];
	}
	else if(cssRule.cssRules && cssRule.cssRules.length){
		allRules = cssRule.cssRules;
	}
	
	if(!allRules) return;


	for(var ci=0, ciMax = allRules.length; ci < ciMax; ci++){
		var rule = allRules[ci];
		var declarations = rule.declarations;
		if(!declarations){
			continue;
		}
		
		var selector = rule.mSelectorText;
		for(var current=0, currentMax = declarations.length; current < currentMax; current++){
			var declaration = declarations[current];
			
			if(declaration.parsedCssText && lookupRulePasses(declaration, lookupRules, excludedRules)){
				var styleRule = new StyleRule(declaration.parsedCssText);
				styleRule.addSelector(selector);
				currentRuleset.addStyleRule(styleRule);
			}
		}
	}
}

function lookupRulePasses(declaration, lookupRules, excludedRules){
	for(var i=0, max = lookupRules.length; i<max; i++){
		var lookupRule = lookupRules[i];
		if(declaration.property && 
		   declaration.property.indexOf(lookupRule) != -1 && 
		   !excludedRulePasses(declaration, excludedRules)){
			return true;
		}
	}
	return false;
}

function excludedRulePasses(declaration, excludedRules){
	for(var i=0, max = excludedRules.length; i<max; i++){
		var excludedRule = excludedRules[i];
		if(declaration.valueText && declaration.valueText.indexOf(excludedRule) != -1) return true;
	}
	return false;
}





function StyleRule(declaration){
	if(!declaration){
		throw "StyleRule requires a declaration";
	}
	
	this.declaration = declaration;
	this.selectors = [];
	
	this.addSelector = function(selector){
		if(!inArray(selector, this.selectors)){
			this.selectors.push(selector);
		}
	}
	this.stringify = function(){
		if(this.selectors.length > 0){
			var selectorSet = this.selectors.join(",");
			return selectorSet + "{" + this.declaration + "}";
		}
		return "";
	}

}

function StyleRuleSet(media){
	
	this.media = media || "";
	this.styleRules = [];

	this.addStyleRule = function(styleRule){
		var currentStyleRule;
		for(var sri = 0, srMax = this.styleRules.length; sri < srMax; sri++) {
			if(styleRule.declaration == this.styleRules[sri].declaration){
				currentStyleRule = this.styleRules[sri];
				break;
			}
		}
		
		if(currentStyleRule && currentStyleRule.selectors){
			for(var i = 0, max = styleRule.selectors.length; i < max; i++) {
				var selector = styleRule.selectors[i];
				if(!inArray(selector, currentStyleRule.selectors)){
					currentStyleRule.addSelector(selector);
				}
			}
		}
		else{
			this.styleRules.push(styleRule);
		}
	}
	
	this.stringify = function(){
		var cssText = "";
		for(var i=0, max=this.styleRules.length; i < max; i++){
			var styleRule = this.styleRules[i];
			cssText += styleRule.stringify();
		}
		
		if(this.media != ""){
			cssText = "@media " + this.media + " {" + cssText + " }";
		}
		
		return cssText;
	}

}

function inArray(val, arr) {
    for(var i = 0, max = arr.length; i < max; i++) {
        if(arr[i] == val) return true;
    }
    return false;
}

function prettyPrint(obj){
	var pretty = stringifyObject(obj, {
		indent: '  ',
		singleQuotes: false
	});
	console.log(pretty);
}



if (typeof exports != "undefined") {
  exports.extractCss = extractCss;
}