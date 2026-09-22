import React, { useState, useEffect, useRef } from "react";
const Slide2: React.FC = () => {
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
  return <div id="slide-2" ref={outerRef} className="w-screen h-screen overflow-hidden relative" style={{
    backgroundColor: "#000"
  }}><div id="slide-inner-2" style={{
      position: "absolute",
      width: "1280px",
      height: "720px",
      overflow: "hidden",
      transformOrigin: "top left",
      color: "#000000",
      backgroundColor: "#ffffff",
      transform: `scale(${layout.s})`,
      left: layout.x + "px",
      top: layout.y + "px"
    }}><div key={0} style={{
        position: "absolute",
        left: "44.99px",
        top: "51.13px",
        width: "1097.2px",
        height: "40.82px",
        boxSizing: "border-box",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#009999"
          }}>{"Balance Sheet \u2013 Liabilities"}</span><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#007BC0"
          }}>{" "}</span><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#D40694"
          }}>{"as "}</span><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#D40694"
          }}>{"of XX"}</span></p></div><div key={1} style={{
        position: "absolute",
        left: "640px",
        top: "103.03px",
        width: "531.82px",
        height: "513.93px",
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Trade Payables: "}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on trade payables)"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Other Liabilities:"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "3pt",
          textIndent: "-18px",
          paddingLeft: "18px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"\xA7"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"Derivative contracts - pointers"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "3pt",
          textIndent: "-18px",
          paddingLeft: "18px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"\xA7"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"Employee payables \u2013 pointers"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "3pt",
          textIndent: "-18px",
          paddingLeft: "18px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"\xA7"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"Bonus Provisions \u2013 pointers"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "3pt",
          textIndent: "-18px",
          paddingLeft: "18px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"\xA7"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"Contract Liabilities (Deferred Revenue) \u2013 pointers"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Non-Current Liabilities & Provisions:"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on non-current liabilities and provisions)"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "3pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p></div><div key={2} style={{
        position: "absolute",
        left: "52.02px",
        top: "420.17px",
        width: "223.25px",
        height: "14.34px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontStyle: "italic",
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#C00000"
          }}>{"*Notes: <if there is any note from the bar graph>"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p></div><div key={3} style={{
        position: "absolute",
        left: "52.02px",
        top: "441.1px",
        width: "559.96px",
        height: "188.89px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700"
          }}>{"Key pointers on old balances:"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700"
          }}>{"HR related balances"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
          }}>{"Pointers on trade receivables)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700"
          }}>{"Provisions for Taxes"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
          }}>{"Pointers on provisions for taxes)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          textIndent: "-18px",
          paddingLeft: "18px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"\xA7"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p></div><div key={4} style={{
        position: "absolute",
        left: "44.65px",
        top: "104.93px",
        width: "513.49px",
        height: "285.77px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        borderRadius: "47.63px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "center",
          lineHeight: "1.2",
          fontSize: "calc(18pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(18pt * var(--pptx-font-scale, 1))",
            color: "#002060"
          }}>{"Placeholder for bar graph: representing change in Asset type between two time periods"}</span></p></div></div></div>;
};
export default Slide2;
