//go:generate go-bindata -ignore=.*.md -ignore=.*.html -ignore=index.js -ignore=.*_test.js -o=loader.go -pkg=$GOPACKAGE -prefix=../loader/ ../loader/

package jsappserver

import (
	"html/template"
	"net/http"
	"os"
	"strings"
)

type Page struct {
	Yoink    template.JS
	Render   template.JS
}

type JsAppServer struct {
	Prefix string
	Root   string
}

func HandleDir(patt string, fp string) {
	prefix := strings.TrimSuffix(patt, "/")
	http.Handle(patt, NewJsAppServer(prefix, fp))
}

func NewJsAppServer(prefix string, root string) http.Handler {
	return &JsAppServer{Prefix: prefix, Root: root}
}

func mkPage(w http.ResponseWriter) error {
	templ := template.New("bar")
	parsedTempl, _ := templ.Parse(jsAppHtml)

	yoinkBytes, err := Asset("yoink.js")
	if err != nil {
		return err
	}

	renderBytes, err := Asset("render.js")
	if err != nil {
		return err
	}

	page := &Page{
		Yoink: template.JS(yoinkBytes),
		Render: template.JS(renderBytes),
	}

	w.Header().Set("Content-Type", "text/html")
	return parsedTempl.Execute(w, page)
}

func serveURL(p string, w http.ResponseWriter, r *http.Request) error {
	if exists(p) {
		http.ServeFile(w, r, p)
		return nil
	} else if exists(p+"index.js") || exists(p+".js") {
		return mkPage(w)
	} else {
		http.NotFound(w, r)
		return nil
	}
}

func (h *JsAppServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p := h.Root + strings.TrimPrefix(r.URL.Path, h.Prefix)
	err := serveURL(p, w, r)
	if err != nil {
		http.Error(w, err.Error(), 500)
	}
}

func exists(p string) bool {

	finfo, err := os.Stat(p)
	return err == nil && !finfo.IsDir()
}

var jsAppHtml = `<!DOCTYPE html>
<html>
  <head></head>
  <body style="margin: 0; padding: 0">
    <script>{{.Yoink}}</script>
    <script>{{.Render}}</script>
  </body>
</html>`
