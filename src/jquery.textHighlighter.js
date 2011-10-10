/**
 * @license jQuery Text Highlighter
 * Copyright (C) 2011 by mirz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function($) {
    var context = null;
    var options = {};
    var methods = {
        init: function(opts) {
            context = this;
            options = $.extend({}, $.fn.textHighlighter.defaults, opts);
            saveState();

            $(context).addClass(options.contextClass);
            bindEvents();
        },
        destroy: function() {
            unbindEvents();
            teardown();
        },
        setColor: function(color) {
            options.color = color;
            saveState();
        },
        getColor: function() {
            return options.color;
        },
        removeHighlights: function(element) {
            var container = (element != undefined ? element : context);
            removeHighlights(container);
        }
    }
    var nodeTypes = {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3
    };

    /**
     * Associates plugin's options with context element.
     */
    function saveState() {
        $(context).data('textHighlighter', options);
    }

    /**
     * Restores plugin's options from data associated with context element.
     */
    function restoreState(ctx) {
        context = ctx;
        options = $(context).data('textHighlighter');
    }

    function bindEvents() {
        $(context).mouseup(doHighlight);
    }

    function unbindEvents() {
        $(context).unbind('mouseup', doHighlight);
    }

    function teardown() {
        $(context).removeClass(options.contextClass);
    }

    /**
     * Highlights currently selected text.
     */
    function doHighlight() {
        restoreState(this);

        var range = getCurrentRange();
        if (!range || range.collapsed) return;

        if (options.onBeforeHighlight(range) == true) {
            var $wrapper = $.fn.textHighlighter.createWrapper(options);

            var createdHighlights = highlightRange(range, $wrapper);
            var normalizedHighlights = normalizeHighlights(createdHighlights);

            options.onAfterHighlight(normalizedHighlights);
        }

        removeAllRanges();
    }

    /**
     * Highlights given range, i.e. wraps it in given wrapper.
     */
    function highlightRange(range, $wrapper) {
        if (range.collapsed) return;

        // Don't highlight content of these tags
        var ignoreTags = ['SCRIPT', 'STYLE', 'SELECT', 'BUTTON', 'OBJECT', 'APPLET'];
        var startContainer = range.startContainer;
        var endContainer = range.endContainer;
        var ancestor = range.commonAncestorContainer;
        var goDeeper = true;

        if (range.endOffset == 0) {
            while (!endContainer.previousSibling && endContainer.parentNode != ancestor) {
                endContainer = endContainer.parentNode;
            }
            endContainer = endContainer.previousSibling;
        } else if (endContainer.nodeType == nodeTypes.TEXT_NODE) {
            if (range.endOffset < endContainer.nodeValue.length) {
                endContainer.splitText(range.endOffset);
            }
        } else if (range.endOffset > 0) {
            endContainer = endContainer.childNodes.item(range.endOffset - 1);
        }

        if (startContainer.nodeType == nodeTypes.TEXT_NODE) {
            if (range.startOffset == startContainer.nodeValue.length) {
                goDeeper = false;
            } else if (range.startOffset > 0) {
                startContainer = startContainer.splitText(range.startOffset);
                if (endContainer == startContainer.previousSibling) endContainer = startContainer;
            }
        } else if (range.startOffset < startContainer.childNodes.length) {
            startContainer = startContainer.childNodes.item(range.startOffset);
        } else {
            startContainer = startContainer.nextSibling;
        }

        var done = false;
        var node = startContainer;
        var highlights = [];

        do {
            if (goDeeper && node.nodeType == nodeTypes.TEXT_NODE) {
                if(/\S/.test(node.nodeValue)) {
                    var wrapper = $wrapper.clone(true).get(0);
                    var highlight = $(node).wrap(wrapper).parent().get(0);
                    highlights.push(highlight);
                }

                goDeeper = false;
            }
            if (node == endContainer && (!endContainer.hasChildNodes() || !goDeeper)) {
                done = true;
            }

            if ($.inArray(node.tagName, ignoreTags) != -1) {
                goDeeper = false;
            }
            if (goDeeper && node.hasChildNodes()) {
                node = node.firstChild;
            } else if (node.nextSibling != null) {
                node = node.nextSibling;
                goDeeper = true;
            } else {
                node = node.parentNode;
                goDeeper = false;
            }
        } while (!done);

        return highlights;
    }

    /**
     * Normalizes highlights, i.e. nested highlights are flattened and sibling higlights are merged.
     */
    function normalizeHighlights(highlights) {
        flattenNestedHighlights(highlights);
        mergeSiblingHighlights(highlights);

        // omit removed nodes
        var normalizedHighlights = $.map(highlights, function(hl) {
            if (typeof hl.parentElement != 'undefined') { // IE
              return hl.parentElement != null ? hl : null;
            } else {
              return hl.parentNode != null ? hl : null;
            }
        });

        return normalizedHighlights;
    }

    function flattenNestedHighlights(highlights) {
        $.each(highlights, function(i) {
            var $highlight = $(this);

            if($highlight.parent().hasClass(options.highlightedClass)) {
                var $parent = $highlight.parent();
                var parentTxt = $parent.text();
                var newNode = document.createTextNode(parentTxt);

                $parent.empty();
                $parent.append(newNode);
                $(highlights[i]).remove();
            }
        });
    }

    function mergeSiblingHighlights(highlights) {
        function shouldMerge(node) {
            return node && node.nodeType == nodeTypes.ELEMENT_NODE &&
                $(node).hasClass(options.highlightedClass) ? true : false;
        }

        $.each(highlights, function() {
            var highlight = this;

            var prev = highlight.previousSibling;
            var next = highlight.nextSibling;

            if (shouldMerge(prev)) {
                var mergedTxt = $(prev).text() + $(highlight).text();
                $(highlight).text(mergedTxt);
                $(prev).remove();
            }
            if(shouldMerge(next)) {
                var mergedTxt = $(highlight).text() + $(next).text();
                $(highlight).text(mergedTxt);
                $(next).remove();
            }
        });
    }

    /**
     * Returns all highlights in given container. If container is a highlight itself and andSelf is
     * true, container will be also returned
     */
    function getAllHighlights(container, andSelf) {
        var classSelectorStr = '.' + options.highlightedClass;
        var $highlights = $(container).find(classSelectorStr);
        if (andSelf == true && $(container).hasClass(options.highlightedClass)) {
            $highlights = $highlights.add(container);
        }
        return $highlights;
    }

    function removeHighlights(container) {
        var unwrapHighlight = function(highlight) {
            return $(highlight).contents().unwrap().get(0);
        };

        var mergeSiblingTextNodes = function(textNode) {
            var prev = textNode.previousSibling;
            var next = textNode.nextSibling;

            if (prev && prev.nodeType == nodeTypes.TEXT_NODE) {
                textNode.nodeValue = prev.nodeValue + textNode.nodeValue;
                prev.parentNode.removeChild(prev);
            }
            if (next && next.nodeType == nodeTypes.TEXT_NODE) {
                textNode.nodeValue = textNode.nodeValue + next.nodeValue;
                next.parentNode.removeChild(next);
            }
        };

        var $highlights = getAllHighlights(container, true);
        $highlights.each(function() {
            if (options.onRemoveHighlight(this) == true) {
                var textNode = unwrapHighlight(this);
                mergeSiblingTextNodes(textNode);
            }
        });
    }

    /**
     * Returns context's owner document.
     */
    function getCurrentDocument() {
        // if ownerDocument is null then context is document
        return context.ownerDocument ? context.ownerDocument : context;
    }

    /**
     * Returns context's owner window.
     */
    function getCurrentWindow() {
        var currentDoc = getCurrentDocument();
        if (currentDoc.defaultView) {
            return currentDoc.defaultView; // Non-IE
        } else {
            return currentDoc.parentWindow; // IE
        }
    }

    /**
     * Returns current selection object.
     */
    function getCurrentSelection() {
        var currentWindow = getCurrentWindow();
        var selection = null;

        if (currentWindow.getSelection) {
            selection = currentWindow.getSelection();
        } else if ($('iframe').length > 0) {
            $('iframe', top.document).each(function() {
                if (this.contentWindow === currentWindow) {
                    selection = rangy.getIframeSelection(this);
                    return false;
                }
            });
        } else {
            selection = rangy.getSelection();
        }

        return selection;
    }

    function getCurrentRange() {
        var selection = getCurrentSelection();
        var range = null;
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        }
        return range;
    }

    function removeAllRanges() {
        var selection = getCurrentSelection();
        selection.removeAllRanges();
    }

    $.fn.textHighlighter = function(method) {
        var args = arguments;

        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(args, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, args);
        } else {
            $.error('Method ' +  method + ' does not exist on jQuery.textHighlighter');
        }
    };

    /**
     * Returns HTML element to wrap selected text in.
     */
    $.fn.textHighlighter.createWrapper = function(opts) {
        return $('<span>')
            .css('backgroundColor', opts.color)
            .addClass(opts.highlightedClass);
    };

    $.fn.textHighlighter.defaults = {
        color: '#ffff7b',
        highlightedClass: 'highlighted',
        contextClass: 'highlighter-context',
        onRemoveHighlight: function() { return true },
        onBeforeHighlight: function() { return true },
        onAfterHighlight: function() { }
    };
})(jQuery);
