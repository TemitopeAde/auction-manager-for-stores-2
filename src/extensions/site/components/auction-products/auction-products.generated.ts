/**
 * THIS FILE IS AUTO-GENERATED — DO NOT EDIT.
 * It contains the `editorElement` portion of the manifest, automatically derived from your component's
 * source code, prop types, and CSS rules.
 * Update your source code and run `npx wix build && npx wix generate manifest` to regenerate it.
 * If you need to override specific manifest values (sizing, layout, etc.),
 * you can do so in auction-products.extension.ts.
 */

import type { EditorElement } from '@wix/react-component-schema';

export const editorElement = {
  "selector": ".auction-products",
  "displayName": "Auction Products",
  "data": {
    "direction": {
      "displayName": "Direction",
      "dataType": "direction"
    },
    "headerTitle": {
      "displayName": "Header Title",
      "dataType": "text",
      "text": {}
    },
    "headerSubtitle": {
      "displayName": "Header Subtitle",
      "dataType": "text",
      "text": {}
    },
    "layout": {
      "displayName": "Layout",
      "dataType": "textEnum",
      "textEnum": {
        "options": [
          {
            "value": "grid",
            "displayName": "Grid"
          },
          {
            "value": "carousel",
            "displayName": "Carousel"
          }
        ]
      }
    },
    "language": {
      "displayName": "Language",
      "dataType": "textEnum",
      "textEnum": {
        "options": [
          {
            "value": "id",
            "displayName": "Id"
          },
          {
            "value": "en",
            "displayName": "En"
          },
          {
            "value": "es",
            "displayName": "Es"
          },
          {
            "value": "fr",
            "displayName": "Fr"
          },
          {
            "value": "de",
            "displayName": "De"
          },
          {
            "value": "pt",
            "displayName": "Pt"
          },
          {
            "value": "it",
            "displayName": "It"
          },
          {
            "value": "nl",
            "displayName": "Nl"
          },
          {
            "value": "ru",
            "displayName": "Ru"
          },
          {
            "value": "ar",
            "displayName": "Ar"
          },
          {
            "value": "hi",
            "displayName": "Hi"
          },
          {
            "value": "bn",
            "displayName": "Bn"
          },
          {
            "value": "ur",
            "displayName": "Ur"
          },
          {
            "value": "tr",
            "displayName": "Tr"
          },
          {
            "value": "zh",
            "displayName": "Zh"
          },
          {
            "value": "ja",
            "displayName": "Ja"
          },
          {
            "value": "ko",
            "displayName": "Ko"
          },
          {
            "value": "vi",
            "displayName": "Vi"
          },
          {
            "value": "pl",
            "displayName": "Pl"
          },
          {
            "value": "th",
            "displayName": "Th"
          }
        ]
      }
    },
    "autoDetectLanguage": {
      "displayName": "Auto Detect Language",
      "dataType": "booleanValue"
    },
    "pageSize": {
      "displayName": "Page Size",
      "dataType": "number",
      "number": {
        "min": "4",
        "max": "60"
      }
    }
  },
  "elements": {
    "auctionProductsHeader": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".auction-products-header",
        "displayName": "Header",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "background": {},
          "borderTop": {},
          "borderBottom": {},
          "borderInlineStart": {},
          "borderInlineEnd": {},
          "paddingTop": {
            "defaultValue": "8px"
          },
          "paddingBottom": {
            "defaultValue": "8px"
          },
          "paddingInlineStart": {
            "defaultValue": "0"
          },
          "paddingInlineEnd": {
            "defaultValue": "0"
          },
          "borderStartStartRadius": {},
          "borderStartEndRadius": {},
          "borderEndStartRadius": {},
          "borderEndEndRadius": {},
          "boxShadow": {},
          "width": {},
          "height": {},
          "overflow": {},
          "mixBlendMode": {},
          "display": {
            "display": {
              "displayValues": [
                "none",
                "flex"
              ]
            }
          },
          "marginTop": {},
          "marginBottom": {},
          "marginInlineStart": {},
          "marginInlineEnd": {},
          "gap": {
            "defaultValue": "8px"
          },
          "flexDirection": {
            "defaultValue": "column"
          },
          "justifyContent": {},
          "alignItems": {
            "defaultValue": "center"
          },
          "alignSelf": {}
        },
        "elements": {
          "auctionProductsTitle": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-title",
              "displayName": "Title",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "700 30px/1.2 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {
                  "defaultValue": "1.2"
                },
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "marginTop": {
                  "defaultValue": "0"
                },
                "marginBottom": {
                  "defaultValue": "0"
                },
                "marginInlineStart": {
                  "defaultValue": "0"
                },
                "marginInlineEnd": {
                  "defaultValue": "0"
                },
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "block"
                    ]
                  }
                },
                "alignSelf": {}
              }
            }
          },
          "auctionProductsSubtitle": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-subtitle",
              "displayName": "Subtitle",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "16px/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {
                  "defaultValue": "1.5"
                },
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#4b5563"
                },
                "marginTop": {
                  "defaultValue": "0"
                },
                "marginBottom": {
                  "defaultValue": "0"
                },
                "marginInlineStart": {
                  "defaultValue": "0"
                },
                "marginInlineEnd": {
                  "defaultValue": "0"
                },
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "block"
                    ]
                  }
                },
                "alignSelf": {}
              }
            }
          },
          "auctionProductsSearch": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-search",
              "displayName": "Search",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "16px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "background": {
                  "defaultValue": "#ffffff"
                },
                "borderTop": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderBottom": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineStart": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineEnd": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "paddingTop": {
                  "defaultValue": "0"
                },
                "paddingBottom": {
                  "defaultValue": "0"
                },
                "paddingInlineStart": {
                  "defaultValue": "14px"
                },
                "paddingInlineEnd": {
                  "defaultValue": "14px"
                },
                "borderStartStartRadius": {
                  "defaultValue": "10px"
                },
                "borderStartEndRadius": {
                  "defaultValue": "10px"
                },
                "borderEndStartRadius": {
                  "defaultValue": "10px"
                },
                "borderEndEndRadius": {
                  "defaultValue": "10px"
                },
                "boxShadow": {},
                "width": {},
                "height": {},
                "overflow": {},
                "mixBlendMode": {},
                "marginTop": {},
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inlineBlock"
                    ]
                  }
                },
                "alignSelf": {}
              },
              "states": {
                "hover": {
                  "displayName": "Hover",
                  "className": "auction-products-search--hover",
                  "pseudoClass": "hover"
                },
                "focus": {
                  "displayName": "Focus",
                  "className": "auction-products-search--focus",
                  "pseudoClass": "focus"
                },
                "disabled": {
                  "displayName": "Disabled",
                  "className": "auction-products-search--disabled",
                  "pseudoClass": "disabled"
                },
                "invalid": {
                  "displayName": "Invalid",
                  "className": "auction-products-search--invalid",
                  "pseudoClass": "invalid"
                }
              }
            }
          },
          "auctionProductsAuctionFilter": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-auction-filter",
              "displayName": "Auction Filter",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "16px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "background": {
                  "defaultValue": "#ffffff"
                },
                "borderTop": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderBottom": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineStart": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineEnd": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "paddingTop": {
                  "defaultValue": "0"
                },
                "paddingBottom": {
                  "defaultValue": "0"
                },
                "paddingInlineStart": {
                  "defaultValue": "12px"
                },
                "paddingInlineEnd": {
                  "defaultValue": "12px"
                },
                "borderStartStartRadius": {
                  "defaultValue": "10px"
                },
                "borderStartEndRadius": {
                  "defaultValue": "10px"
                },
                "borderEndStartRadius": {
                  "defaultValue": "10px"
                },
                "borderEndEndRadius": {
                  "defaultValue": "10px"
                },
                "boxShadow": {},
                "width": {},
                "height": {},
                "overflow": {},
                "mixBlendMode": {},
                "marginTop": {},
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inlineBlock"
                    ]
                  }
                },
                "alignSelf": {}
              },
              "states": {
                "hover": {
                  "displayName": "Hover",
                  "className": "auction-products-auction-filter--hover",
                  "pseudoClass": "hover"
                },
                "focus": {
                  "displayName": "Focus",
                  "className": "auction-products-auction-filter--focus",
                  "pseudoClass": "focus"
                },
                "disabled": {
                  "displayName": "Disabled",
                  "className": "auction-products-auction-filter--disabled",
                  "pseudoClass": "disabled"
                },
                "invalid": {
                  "displayName": "Invalid",
                  "className": "auction-products-auction-filter--invalid",
                  "pseudoClass": "invalid"
                }
              }
            }
          },
          "auctionProductsTimerFilter": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-timer-filter",
              "displayName": "Timer Filter",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "16px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "background": {
                  "defaultValue": "#ffffff"
                },
                "borderTop": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderBottom": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineStart": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineEnd": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "paddingTop": {
                  "defaultValue": "0"
                },
                "paddingBottom": {
                  "defaultValue": "0"
                },
                "paddingInlineStart": {
                  "defaultValue": "12px"
                },
                "paddingInlineEnd": {
                  "defaultValue": "12px"
                },
                "borderStartStartRadius": {
                  "defaultValue": "10px"
                },
                "borderStartEndRadius": {
                  "defaultValue": "10px"
                },
                "borderEndStartRadius": {
                  "defaultValue": "10px"
                },
                "borderEndEndRadius": {
                  "defaultValue": "10px"
                },
                "boxShadow": {},
                "width": {},
                "height": {},
                "overflow": {},
                "mixBlendMode": {},
                "marginTop": {},
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inlineBlock"
                    ]
                  }
                },
                "alignSelf": {}
              },
              "states": {
                "hover": {
                  "displayName": "Hover",
                  "className": "auction-products-timer-filter--hover",
                  "pseudoClass": "hover"
                },
                "focus": {
                  "displayName": "Focus",
                  "className": "auction-products-timer-filter--focus",
                  "pseudoClass": "focus"
                },
                "disabled": {
                  "displayName": "Disabled",
                  "className": "auction-products-timer-filter--disabled",
                  "pseudoClass": "disabled"
                },
                "invalid": {
                  "displayName": "Invalid",
                  "className": "auction-products-timer-filter--invalid",
                  "pseudoClass": "invalid"
                }
              }
            }
          }
        }
      }
    },
    "auctionProductsCarouselArrow": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".auction-products-carousel-arrow",
        "displayName": "Carousel Arrow",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "color": {
            "defaultValue": "#172126"
          },
          "background": {
            "defaultValue": "#ffffff",
            "statesDefaultValues": {
              "hover": "#f3efe9"
            }
          },
          "borderTop": {
            "defaultValue": "1px solid #e5e1da"
          },
          "borderBottom": {
            "defaultValue": "1px solid #e5e1da"
          },
          "borderInlineStart": {
            "defaultValue": "1px solid #e5e1da"
          },
          "borderInlineEnd": {
            "defaultValue": "1px solid #e5e1da"
          },
          "paddingTop": {},
          "paddingBottom": {},
          "paddingInlineStart": {},
          "paddingInlineEnd": {},
          "borderStartStartRadius": {
            "defaultValue": "50%"
          },
          "borderStartEndRadius": {
            "defaultValue": "50%"
          },
          "borderEndStartRadius": {
            "defaultValue": "50%"
          },
          "borderEndEndRadius": {
            "defaultValue": "50%"
          },
          "boxShadow": {},
          "width": {
            "defaultValue": "44px"
          },
          "height": {
            "defaultValue": "44px"
          },
          "overflow": {},
          "mixBlendMode": {},
          "display": {
            "display": {
              "displayValues": [
                "none",
                "inlineGrid"
              ]
            }
          },
          "font": {
            "defaultValue": "24px 'Helvetica Neue',Helvetica,Arial,sans-serif"
          },
          "lineHeight": {},
          "letterSpacing": {},
          "textDecorationLine": {},
          "textTransform": {},
          "textAlign": {},
          "textShadow": {},
          "marginTop": {},
          "marginBottom": {},
          "marginInlineStart": {},
          "marginInlineEnd": {},
          "flexDirection": {},
          "justifyContent": {},
          "alignItems": {},
          "alignSelf": {}
        },
        "states": {
          "hover": {
            "displayName": "Hover",
            "className": "auction-products-carousel-arrow--hover",
            "pseudoClass": "hover"
          },
          "disabled": {
            "displayName": "Disabled",
            "className": "auction-products-carousel-arrow--disabled",
            "pseudoClass": "disabled"
          }
        }
      }
    },
    "auctionProductsCard": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".auction-products-card",
        "displayName": "Card",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "background": {
            "defaultValue": "#ffffff"
          },
          "borderTop": {
            "defaultValue": "1px solid #e5e1da"
          },
          "borderBottom": {
            "defaultValue": "1px solid #e5e1da"
          },
          "borderInlineStart": {
            "defaultValue": "1px solid #e5e1da"
          },
          "borderInlineEnd": {
            "defaultValue": "1px solid #e5e1da"
          },
          "paddingTop": {},
          "paddingBottom": {},
          "paddingInlineStart": {},
          "paddingInlineEnd": {},
          "borderStartStartRadius": {
            "defaultValue": "12px"
          },
          "borderStartEndRadius": {
            "defaultValue": "12px"
          },
          "borderEndStartRadius": {
            "defaultValue": "12px"
          },
          "borderEndEndRadius": {
            "defaultValue": "12px"
          },
          "boxShadow": {
            "defaultValue": "0 8px 24px rgba(65,50,34,0.08)"
          },
          "width": {},
          "height": {},
          "overflow": {
            "defaultValue": "hidden"
          },
          "mixBlendMode": {},
          "display": {
            "display": {
              "displayValues": [
                "none",
                "flex"
              ]
            }
          },
          "marginTop": {},
          "marginBottom": {},
          "marginInlineStart": {},
          "marginInlineEnd": {},
          "gap": {},
          "flexDirection": {
            "defaultValue": "column"
          },
          "justifyContent": {},
          "alignItems": {},
          "alignSelf": {}
        },
        "elements": {
          "auctionProductsStatusBadge": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-status-badge",
              "displayName": "Status Badge",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "700 14px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {
                  "defaultValue": "0.04em"
                },
                "textDecorationLine": {},
                "textTransform": {
                  "defaultValue": "uppercase"
                },
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#374151",
                  "statesDefaultValues": {
                    "live": "#ffffff",
                    "ending-soon": "#ffffff",
                    "scheduled": "#ffffff",
                    "paused": "#ffffff",
                    "ended": "#ffffff",
                    "sold": "#ffffff"
                  }
                },
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "none"
                    ]
                  }
                },
                "marginTop": {},
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "alignSelf": {}
              },
              "states": {
                "live": {
                  "displayName": "Live",
                  "className": "auction-products-status-badge--live"
                },
                "ending-soon": {
                  "displayName": "Ending Soon",
                  "className": "auction-products-status-badge--ending-soon"
                },
                "scheduled": {
                  "displayName": "Scheduled",
                  "className": "auction-products-status-badge--scheduled"
                },
                "paused": {
                  "displayName": "Paused",
                  "className": "auction-products-status-badge--paused"
                },
                "ended": {
                  "displayName": "Ended",
                  "className": "auction-products-status-badge--ended"
                },
                "sold": {
                  "displayName": "Sold",
                  "className": "auction-products-status-badge--sold"
                },
                "none": {
                  "displayName": "None",
                  "className": "auction-products-status-badge--none"
                }
              }
            }
          },
          "auctionProductsProductName": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-product-name",
              "displayName": "Product Name",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "600 18px/1.3 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {
                  "defaultValue": "1.3"
                },
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "marginTop": {
                  "defaultValue": "0"
                },
                "marginBottom": {
                  "defaultValue": "0"
                },
                "marginInlineStart": {
                  "defaultValue": "0"
                },
                "marginInlineEnd": {
                  "defaultValue": "0"
                },
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "block"
                    ]
                  }
                },
                "alignSelf": {}
              }
            }
          },
          "auctionProductsMetaLabel": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-meta-label",
              "displayName": "Meta Label",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "14px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#4b5563"
                },
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inline"
                    ]
                  }
                },
                "alignSelf": {}
              }
            }
          },
          "auctionProductsMetaValue": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-meta-value",
              "displayName": "Meta Value",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "700 18px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inline"
                    ]
                  }
                },
                "alignSelf": {}
              }
            }
          },
          "auctionProductsTiming": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-timing",
              "displayName": "Timing",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "14px/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {
                  "defaultValue": "1.5"
                },
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#374151"
                },
                "marginTop": {
                  "defaultValue": "0"
                },
                "marginBottom": {
                  "defaultValue": "0"
                },
                "marginInlineStart": {
                  "defaultValue": "0"
                },
                "marginInlineEnd": {
                  "defaultValue": "0"
                },
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "block"
                    ]
                  }
                },
                "alignSelf": {}
              }
            }
          },
          "auctionProductsViewButton": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-view-button",
              "displayName": "View Button",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "color": {
                  "defaultValue": "#ffffff"
                },
                "background": {
                  "defaultValue": "#172126",
                  "statesDefaultValues": {
                    "hover": "#2f3d46"
                  }
                },
                "borderTop": {
                  "defaultValue": "none"
                },
                "borderBottom": {
                  "defaultValue": "none"
                },
                "borderInlineStart": {
                  "defaultValue": "none"
                },
                "borderInlineEnd": {
                  "defaultValue": "none"
                },
                "paddingTop": {
                  "defaultValue": "10px"
                },
                "paddingBottom": {
                  "defaultValue": "10px"
                },
                "paddingInlineStart": {
                  "defaultValue": "14px"
                },
                "paddingInlineEnd": {
                  "defaultValue": "14px"
                },
                "borderStartStartRadius": {
                  "defaultValue": "8px"
                },
                "borderStartEndRadius": {
                  "defaultValue": "8px"
                },
                "borderEndStartRadius": {
                  "defaultValue": "8px"
                },
                "borderEndEndRadius": {
                  "defaultValue": "8px"
                },
                "boxShadow": {},
                "width": {},
                "height": {},
                "overflow": {},
                "mixBlendMode": {},
                "marginTop": {},
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inlineBlock"
                    ]
                  }
                },
                "font": {
                  "defaultValue": "700 14px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {
                  "defaultValue": "0.04em"
                },
                "textDecorationLine": {},
                "textTransform": {
                  "defaultValue": "uppercase"
                },
                "textAlign": {},
                "textShadow": {},
                "alignSelf": {}
              },
              "states": {
                "hover": {
                  "displayName": "Hover",
                  "className": "auction-products-view-button--hover",
                  "pseudoClass": "hover"
                },
                "disabled": {
                  "displayName": "Disabled",
                  "className": "auction-products-view-button--disabled",
                  "pseudoClass": "disabled"
                }
              }
            }
          },
          "auctionProductsBidButton": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-bid-button",
              "displayName": "Bid Button",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "color": {
                  "defaultValue": "#ffffff"
                },
                "background": {
                  "defaultValue": "#8c6b45",
                  "statesDefaultValues": {
                    "hover": "#6f5233"
                  }
                },
                "borderTop": {
                  "defaultValue": "none"
                },
                "borderBottom": {
                  "defaultValue": "none"
                },
                "borderInlineStart": {
                  "defaultValue": "none"
                },
                "borderInlineEnd": {
                  "defaultValue": "none"
                },
                "paddingTop": {
                  "defaultValue": "0"
                },
                "paddingBottom": {
                  "defaultValue": "0"
                },
                "paddingInlineStart": {
                  "defaultValue": "0"
                },
                "paddingInlineEnd": {
                  "defaultValue": "0"
                },
                "borderStartStartRadius": {
                  "defaultValue": "8px"
                },
                "borderStartEndRadius": {
                  "defaultValue": "8px"
                },
                "borderEndStartRadius": {
                  "defaultValue": "8px"
                },
                "borderEndEndRadius": {
                  "defaultValue": "8px"
                },
                "boxShadow": {},
                "width": {
                  "defaultValue": "44px"
                },
                "height": {},
                "overflow": {},
                "mixBlendMode": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inlineFlex"
                    ]
                  }
                },
                "font": {
                  "defaultValue": "700 14px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "marginTop": {},
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "flexDirection": {},
                "justifyContent": {
                  "defaultValue": "center"
                },
                "alignItems": {
                  "defaultValue": "center"
                },
                "alignSelf": {}
              },
              "states": {
                "hover": {
                  "displayName": "Hover",
                  "className": "auction-products-bid-button--hover",
                  "pseudoClass": "hover"
                },
                "disabled": {
                  "displayName": "Disabled",
                  "className": "auction-products-bid-button--disabled",
                  "pseudoClass": "disabled"
                }
              }
            }
          }
        }
      }
    },
    "auctionProductsLoadMoreButton": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".auction-products-load-more-button",
        "displayName": "Load More Button",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "color": {
            "defaultValue": "#172126"
          },
          "background": {
            "defaultValue": "#ffffff",
            "statesDefaultValues": {
              "hover": "#f3efe9"
            }
          },
          "borderTop": {
            "defaultValue": "1px solid #172126"
          },
          "borderBottom": {
            "defaultValue": "1px solid #172126"
          },
          "borderInlineStart": {
            "defaultValue": "1px solid #172126"
          },
          "borderInlineEnd": {
            "defaultValue": "1px solid #172126"
          },
          "paddingTop": {
            "defaultValue": "10px"
          },
          "paddingBottom": {
            "defaultValue": "10px"
          },
          "paddingInlineStart": {
            "defaultValue": "24px"
          },
          "paddingInlineEnd": {
            "defaultValue": "24px"
          },
          "borderStartStartRadius": {
            "defaultValue": "8px"
          },
          "borderStartEndRadius": {
            "defaultValue": "8px"
          },
          "borderEndStartRadius": {
            "defaultValue": "8px"
          },
          "borderEndEndRadius": {
            "defaultValue": "8px"
          },
          "boxShadow": {},
          "width": {},
          "height": {},
          "overflow": {},
          "mixBlendMode": {},
          "marginTop": {},
          "marginBottom": {},
          "marginInlineStart": {},
          "marginInlineEnd": {},
          "display": {
            "display": {
              "displayValues": [
                "none",
                "inlineBlock"
              ]
            }
          },
          "font": {
            "defaultValue": "700 15px 'Helvetica Neue',Helvetica,Arial,sans-serif"
          },
          "lineHeight": {},
          "letterSpacing": {},
          "textDecorationLine": {},
          "textTransform": {},
          "textAlign": {},
          "textShadow": {},
          "alignSelf": {}
        },
        "states": {
          "hover": {
            "displayName": "Hover",
            "className": "auction-products-load-more-button--hover",
            "pseudoClass": "hover"
          },
          "disabled": {
            "displayName": "Disabled",
            "className": "auction-products-load-more-button--disabled",
            "pseudoClass": "disabled"
          }
        }
      }
    },
    "auctionProductsBidDialog": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".auction-products-bid-dialog",
        "displayName": "Bid Dialog",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "background": {
            "defaultValue": "#ffffff"
          },
          "borderTop": {
            "defaultValue": "none"
          },
          "borderBottom": {
            "defaultValue": "none"
          },
          "borderInlineStart": {
            "defaultValue": "none"
          },
          "borderInlineEnd": {
            "defaultValue": "none"
          },
          "paddingTop": {
            "defaultValue": "24px"
          },
          "paddingBottom": {
            "defaultValue": "24px"
          },
          "paddingInlineStart": {
            "defaultValue": "24px"
          },
          "paddingInlineEnd": {
            "defaultValue": "24px"
          },
          "borderStartStartRadius": {
            "defaultValue": "16px"
          },
          "borderStartEndRadius": {
            "defaultValue": "16px"
          },
          "borderEndStartRadius": {
            "defaultValue": "16px"
          },
          "borderEndEndRadius": {
            "defaultValue": "16px"
          },
          "boxShadow": {
            "defaultValue": "0 24px 64px rgba(0,0,0,0.24)"
          },
          "width": {
            "defaultValue": "min(440px,calc(100% - 32px))"
          },
          "height": {},
          "overflow": {},
          "mixBlendMode": {},
          "marginTop": {},
          "marginBottom": {},
          "marginInlineStart": {},
          "marginInlineEnd": {},
          "display": {
            "display": {
              "displayValues": [
                "none",
                "block"
              ]
            }
          },
          "alignSelf": {}
        },
        "elements": {
          "auctionProductsDialogTitle": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-dialog-title",
              "displayName": "Dialog Title",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "700 22px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "marginTop": {
                  "defaultValue": "0"
                },
                "marginBottom": {
                  "defaultValue": "0"
                },
                "marginInlineStart": {
                  "defaultValue": "0"
                },
                "marginInlineEnd": {
                  "defaultValue": "0"
                },
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "block"
                    ]
                  }
                }
              }
            }
          },
          "auctionProductsDialogInput": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-dialog-input",
              "displayName": "Dialog Input",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "font": {
                  "defaultValue": "16px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "color": {
                  "defaultValue": "#172126"
                },
                "background": {
                  "defaultValue": "#ffffff"
                },
                "borderTop": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderBottom": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineStart": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "borderInlineEnd": {
                  "defaultValue": "1px solid #cfd4da"
                },
                "paddingTop": {
                  "defaultValue": "0"
                },
                "paddingBottom": {
                  "defaultValue": "0"
                },
                "paddingInlineStart": {
                  "defaultValue": "12px"
                },
                "paddingInlineEnd": {
                  "defaultValue": "12px"
                },
                "borderStartStartRadius": {
                  "defaultValue": "10px"
                },
                "borderStartEndRadius": {
                  "defaultValue": "10px"
                },
                "borderEndStartRadius": {
                  "defaultValue": "10px"
                },
                "borderEndEndRadius": {
                  "defaultValue": "10px"
                },
                "boxShadow": {},
                "width": {
                  "defaultValue": "100%"
                },
                "height": {},
                "overflow": {},
                "mixBlendMode": {},
                "marginTop": {},
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inlineBlock"
                    ]
                  }
                }
              },
              "states": {
                "hover": {
                  "displayName": "Hover",
                  "className": "auction-products-dialog-input--hover",
                  "pseudoClass": "hover"
                },
                "focus": {
                  "displayName": "Focus",
                  "className": "auction-products-dialog-input--focus",
                  "pseudoClass": "focus"
                },
                "disabled": {
                  "displayName": "Disabled",
                  "className": "auction-products-dialog-input--disabled",
                  "pseudoClass": "disabled"
                },
                "invalid": {
                  "displayName": "Invalid",
                  "className": "auction-products-dialog-input--invalid",
                  "pseudoClass": "invalid"
                }
              }
            }
          },
          "auctionProductsSubmitButton": {
            "elementType": "inlineElement",
            "inlineElement": {
              "selector": ".auction-products-submit-button",
              "displayName": "Submit Button",
              "behaviors": {
                "removable": true,
                "selectable": false
              },
              "cssProperties": {
                "color": {
                  "defaultValue": "#ffffff"
                },
                "background": {
                  "defaultValue": "#172126",
                  "statesDefaultValues": {
                    "hover": "#2f3d46"
                  }
                },
                "borderTop": {
                  "defaultValue": "none"
                },
                "borderBottom": {
                  "defaultValue": "none"
                },
                "borderInlineStart": {
                  "defaultValue": "none"
                },
                "borderInlineEnd": {
                  "defaultValue": "none"
                },
                "paddingTop": {
                  "defaultValue": "12px"
                },
                "paddingBottom": {
                  "defaultValue": "12px"
                },
                "paddingInlineStart": {
                  "defaultValue": "20px"
                },
                "paddingInlineEnd": {
                  "defaultValue": "20px"
                },
                "borderStartStartRadius": {
                  "defaultValue": "10px"
                },
                "borderStartEndRadius": {
                  "defaultValue": "10px"
                },
                "borderEndStartRadius": {
                  "defaultValue": "10px"
                },
                "borderEndEndRadius": {
                  "defaultValue": "10px"
                },
                "boxShadow": {},
                "width": {},
                "height": {},
                "overflow": {},
                "mixBlendMode": {},
                "display": {
                  "display": {
                    "displayValues": [
                      "none",
                      "inlineFlex"
                    ]
                  }
                },
                "font": {
                  "defaultValue": "700 16px 'Helvetica Neue',Helvetica,Arial,sans-serif"
                },
                "lineHeight": {},
                "letterSpacing": {},
                "textDecorationLine": {},
                "textTransform": {},
                "textAlign": {},
                "textShadow": {},
                "marginTop": {
                  "defaultValue": "8px"
                },
                "marginBottom": {},
                "marginInlineStart": {},
                "marginInlineEnd": {},
                "flexDirection": {},
                "justifyContent": {
                  "defaultValue": "center"
                },
                "alignItems": {
                  "defaultValue": "center"
                }
              },
              "states": {
                "hover": {
                  "displayName": "Hover",
                  "className": "auction-products-submit-button--hover",
                  "pseudoClass": "hover"
                },
                "disabled": {
                  "displayName": "Disabled",
                  "className": "auction-products-submit-button--disabled",
                  "pseudoClass": "disabled"
                }
              }
            }
          }
        }
      }
    }
  },
  "cssProperties": {
    "background": {
      "defaultValue": "#faf8f5"
    },
    "borderTop": {},
    "borderBottom": {},
    "borderInlineStart": {},
    "borderInlineEnd": {},
    "paddingTop": {
      "defaultValue": "24px"
    },
    "paddingBottom": {
      "defaultValue": "24px"
    },
    "paddingInlineStart": {
      "defaultValue": "24px"
    },
    "paddingInlineEnd": {
      "defaultValue": "24px"
    },
    "borderStartStartRadius": {},
    "borderStartEndRadius": {},
    "borderEndStartRadius": {},
    "borderEndEndRadius": {},
    "boxShadow": {},
    "overflow": {},
    "mixBlendMode": {},
    "gap": {
      "defaultValue": "24px"
    },
    "flexDirection": {
      "defaultValue": "column"
    },
    "justifyContent": {},
    "alignItems": {}
  },
  "cssCustomProperties": {}
} as EditorElement;
