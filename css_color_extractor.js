var jscssp = require('jscssp');
var css = require('css');
var stringifyObject = require('stringify-object');
var parser = new jscssp.CSSParser();
var sheet = parser.parse('ul li a  { background: #000000; font: "Times New Roman",Georgia,Serif;} body .steve .joe    #nick { background: #000000; border: solid red 1px; } H1{ font-size: 24px; color: #FF0000; } H2{ font: 12px; background-color: #000000; } @keyframes my_anim { from { opacity: 1; } to { opacity: 0; } } @media screen AND (max-width: 500px) { body { background: #f0f0f0; width: 500px; height: 20px; }} @media tv and (min-width: 700px) and (orientation: landscape) { h3 { background: #f0f0f0; width: 500px; height: 20px; } h4.steve .jack li { background: #CCCCCC; font-family: Helvetica,Georgia,Serif;}}', false, true);
//prettyPrint(sheet);


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
var lookupRules = ["color"];


var cssRules = sheet.cssRules;
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

function extractMedia(media){
	if(media && media.length != 0){
		return media[0];
	}
	return "";
}

prettyPrint(finalRulesets); //This is as far as I've gotten

function addStyleRule(cssRule, currentRuleset){
	var selector = cssRule.mSelectorText;
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
		for(var current=0, currentMax = declarations.length; current < currentMax; current++){
			var declaration = declarations[current];
			
			if(declaration.parsedCssText && lookupRulePasses(declaration, lookupRules)){
				var styleRule = new StyleRule(declaration.parsedCssText);
				styleRule.addSelector(selector);
				currentRuleset.addStyleRule(styleRule);
			}
		}
	}
}

function lookupRulePasses(declaration, lookupRules){
	for(var i=0, max = lookupRules.length; i<max; i++){
		var lookupRule = lookupRules[i];
		if(declaration.property.indexOf(lookupRule) != -1) return true;
	}
	return false;
}



function addCssRuleOld(cssRule, finalCssRules, wrapperDeclaration){
	var selector = cssRule.mSelectorText;
	var declarations = cssRule.declarations;
	for(var current=0, currentMax = declarations.length; current < currentMax; current++){
		var declaration = declarations[current];
		if(declaration.property && declaration.property.indexOf(lookupRule) != -1){
			if(finalCssRules[declaration.parsedCssText]){
				if(!inArray(selector, finalCssRules[declaration.parsedCssText])){
					finalCssRules[declaration.parsedCssText].push(selector);
				}
			}
			else{
				finalCssRules[declaration.parsedCssText] = [selector];
			}
		}
	}
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
		if(selectorSet.length > 0){
			var selectorSet = this.selectors.join(",");
			return selectorSet + "{" + this.declaration + "}";
		}
		throw "No selectors for declaration: " + this.declaration;
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
		prettyPrint(this);
	}

}



function parseMediaQuery(selector){
	//console.log("Media Query: "+ selector);
	var mediaQueryRules = css.parse(selector);
	//prettyPrint(mediaQueryRules);
	var mediaQueryInnerRuleText = "";
	var styleRules = mediaQueryRules.stylesheet.rules;
	
	//console.log(styleRules.length);
	for(var srIndex = 0, styleRulesMax = styleRules.length; srIndex < styleRulesMax; srIndex++){
		var styleRule = styleRules[srIndex];
		var mQuery = new MediaQuery("@media " + styleRule.media);
		//console.log("starting mq: " + styleRule.media);
		
		var mediaRules = styleRule.rules;
		for(var mrIndex = 0, mediaRulesMax = mediaRules.length; mrIndex < mediaRulesMax; mrIndex++){
			var mediaRule = mediaRules[mrIndex];
			var mediaRuleStringified = stringifyMediaRule(mediaRule);
			//console.log("Rule explained: ");
			//prettyPrint(mediaRuleStringified);
			var mediaRuleExpanded = parser.parse(mediaRuleStringified);
			
			//prettyPrint(mediaRuleExpanded);
			//console.log(mediaRuleExpanded.cssText());
		}
		
		
	}
	
}

function stringifyMediaRule(rule){
	//console.log("starting");
	//console.log(rule.type);
	if(rule.type === "rule"){
		var selector = rule.selectors.join(",") + "{ ";
		var declarations = rule.declarations;
		for(var i=0, max = declarations.length; i<max; i++){
			selector += declarations[i].property + ": " + declarations[i].value + "; ";
		}
		selector += " }";
		return selector;
	}
	return "";
}


// var outputCss = "";
// for(var colorRuleKey in finalCssRules){
	// var colorRuleSelectors = finalCssRules[colorRuleKey];
	
	// var colorDeclaration = colorRuleKey;
	// var pos = colorDeclaration.lastIndexOf(';');
	// if(pos != -1){
		// colorDeclaration = colorDeclaration.substring(0,pos);
	// }

	// var selectorSet = colorRuleSelectors.join(",");
	// outputCss += selectorSet + "{" + colorDeclaration + "}";
// }

// console.log(outputCss);
// console.log(css.stringify(css.parse(outputCss)));



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



