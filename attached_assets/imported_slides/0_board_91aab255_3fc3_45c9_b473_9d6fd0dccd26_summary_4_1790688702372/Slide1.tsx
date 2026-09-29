import React, { useState, useEffect, useRef } from "react";
const Slide1: React.FC = () => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({
    s: 1,
    x: 0,
    y: 0
  });
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(w / 1280, h / 720);
      setLayout({
        s,
        x: (w - 1280 * s) / 2,
        y: (h - 720 * s) / 2
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div id="slide-1" ref={outerRef} className="w-screen h-screen overflow-hidden relative" style={{
    backgroundColor: "#000"
  }}><div id="slide-inner-1" style={{
      position: "absolute",
      width: "1280px",
      height: "720px",
      overflow: "hidden",
      transformOrigin: "top left",
      color: "#000000",
      backgroundColor: "#FFFFFF",
      transform: `scale(${layout.s})`,
      left: layout.x + "px",
      top: layout.y + "px"
    }}><div key={0} style={{
        position: "absolute",
        left: "40.32px",
        top: "26.88px",
        width: "1171.2px",
        height: "40.32px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos Display', sans-serif",
            fontWeight: "700",
            color: "#143B45"
          }}>{"Entity P&L \u2013 All entities"}</span></p></div><table key={1} style={{
        position: "absolute",
        left: "40.32px",
        top: "109.44px",
        width: "1176px",
        height: "505.92px",
        borderCollapse: "collapse",
        tableLayout: "fixed"
      }}><colgroup><col style={{
            width: "16.73%"
          }} /><col style={{
            width: "16.65%"
          }} /><col style={{
            width: "16.65%"
          }} /><col style={{
            width: "16.65%"
          }} /><col style={{
            width: "16.65%"
          }} /><col style={{
            width: "16.65%"
          }} /></colgroup><tbody><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Line item"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Jul 2026 MTD"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Apr 2026 MTD"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Dec 2025 YE"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Variance"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"%"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Revenue"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Employee Benefits"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Outsourcing Cost"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Consultancy Charges"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"CI Charges & Other Revenue"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Facilities Cost"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Other Expenses"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Total Expenses"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"EBIT"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"EBIT%"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"End Capacity On-roll"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"28,671.5"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"End Capacity Outsourcing"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"3,884"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Total End"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"32,555.5"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Avg Capacity Overall"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Avg Capacity Outsourcing"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr><tr style={{
            height: "29.76px"
          }}><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"Total Average"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td><td style={{
              padding: "4px 8px",
              verticalAlign: "top",
              fontSize: "7pt",
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #D8DEE4",
              borderBottom: "1px solid #D8DEE4",
              borderLeft: "1px solid #D8DEE4",
              borderRight: "1px solid #D8DEE4"
            }}><p style={{
                textAlign: "right",
                lineHeight: "1.2",
                fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                marginTop: "0",
                marginBottom: "0"
              }}><span style={{
                  fontSize: "calc(7pt * var(--pptx-font-scale, 1))",
                  fontFamily: "'Aptos', sans-serif",
                  color: "#1F2937"
                }}>{"\u2014"}</span></p></td></tr></tbody></table><div key={2} style={{
        position: "absolute",
        left: "41.28px",
        top: "74.88px",
        width: "1171.2px",
        height: "20.16px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(9pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(9pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#58666B"
          }}>{"Jul 2026 MTD \xB7 QOQ versus Apr 2026 MTD \xB7 Values in INR"}</span></p></div><div key={3} style={{
        position: "absolute",
        left: "40.32px",
        top: "665.28px",
        width: "1161.6px",
        height: "26.88px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0px 0px 0px 0px",
        ["--pptx-font-scale"]: "0.875",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(6.4pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(6.4pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#667085"
          }}>{"Actual source snapshots are missing (Jun 2026: Revenue Summary and Cost Summary; Apr 2026: Revenue Summary and Cost Summary; Mar 2026: Revenue Summary and Cost Summary; Dec 2025: Revenue Summary and Cost Summary); affected P&L values are shown as \u2014, not zero.  \xB7  Capacity snapshots are missing for Apr 2026 MTD, Dec 2025 YE; affected end-capacity values are shown as \u2014.  \xB7  YTD capacity averages are unavailable because monthly capacity snapshots are incomplete: Jul 2026 MTD (missing Jan 2026, Feb 2026, Mar 2026, Apr 2026, May 2026, Jun 2026); Apr 2026 MTD (missing Jan 2026, Feb 2026, Mar 2026, Apr 2026); Dec 2025 YE (missing Jan 2025, Feb 2025, Mar 2025, Apr 2025, May 2025, Jun 2025, Jul 2025, Aug 2025, Sep 2025, Oct 2025, Nov 2025, Dec 2025)."}</span></p></div></div></div>;
};
export default Slide1;
