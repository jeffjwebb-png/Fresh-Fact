const express equals require open paren single quote express single quote, close paren, semicolon
const app equals express open paren close paren semicolon
const port equals process dot env dot PORT or 3000 semicolon
app dot get open paren single quote slash single quote comma open paren req comma res close paren space equals greater than space open curly brace
res dot json open paren open curly message colon single quote FreshFact API is live single quote close curly close paren semicolon
Close curly close paren semicolon
app dot listen open paren port comma open paren close paren equals greater than open curly console dot log open paren single quote FreshFact API is running single quote close paren semicolon close curly close paren semicolon
