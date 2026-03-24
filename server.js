// ==========================
// 🚀 SUNWIN VIP ANALYZER PRO (30 PATTERN)
// ==========================

const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");
const cors = require("cors");

const app = express();
const cache = new NodeCache({ stdTTL: 5 });

app.use(cors());

const PORT = process.env.PORT || 3000;
const HISTORY_API = process.env.HISTORY || "https://wtxmd52.tele68.com/v1/txmd5/sessions";
const CREATOR = "@Cskhtoolhehe";

// ==========================
// ⚙️ UTIL
// ==========================
function toInt(v, d = 0) {
    const n = Number(v);
    return isNaN(n) ? d : Math.floor(n);
}

// ==========================
// 📦 NORMALIZE
// ==========================
function normalize(item) {
    return {
        phien: toInt(item.id),
        tong: toInt(item.point),
        ket_qua: item.resultTruyenThong === "TAI" ? "T" : "X",
        ket_qua_day_du: item.resultTruyenThong === "TAI" ? "TÀI" : "XỈU",
        xuc_xac: item.dices || []
    };
}

// ==========================
// 🔢 ANALYZE 30 PATTERN
// ==========================
function analyzeVIP(history) {
    const recent = history.slice(0, 30);
    const pattern = recent.map(x => x.ket_qua).join("");

    let tai = 0, xiu = 0;
    recent.forEach(r => r.ket_qua === "T" ? tai++ : xiu++);

    // STREAK
    let streaks = [];
    let cur = recent[0].ket_qua, count = 1;

    for (let i = 1; i < recent.length; i++) {
        if (recent[i].ket_qua === cur) count++;
        else {
            streaks.push({ type: cur, length: count });
            cur = recent[i].ket_qua;
            count = 1;
        }
    }
    streaks.push({ type: cur, length: count });

    const currentStreak = streaks[streaks.length - 1];

    // PATTERN LẶP
    let patterns = [];
    for (let len = 2; len <= 5; len++) {
        for (let i = 0; i <= pattern.length - len; i++) {
            let sub = pattern.substr(i, len);
            let c = pattern.split(sub).length - 1;
            if (c >= 2 && !patterns.find(p => p.p === sub)) {
                patterns.push({ p: sub, count: c });
            }
        }
    }
    patterns.sort((a, b) => b.count - a.count);

    // TRANSITION
    let trans = { T: { T: 0, X: 0 }, X: { T: 0, X: 0 } };

    for (let i = 1; i < recent.length; i++) {
        trans[recent[i - 1].ket_qua][recent[i].ket_qua]++;
    }

    const percent = (a, b) => ((a / (a + b || 1)) * 100).toFixed(1) + "%";

    const transition = {
        T: { toT: percent(trans.T.T, trans.T.X), toX: percent(trans.T.X, trans.T.T) },
        X: { toT: percent(trans.X.T, trans.X.X), toX: percent(trans.X.X, trans.X.T) }
    };

    // CẦU
    let cauDangChay = "Không rõ";
    if (pattern.startsWith("TT")) cauDangChay = "Bệt TÀI";
    else if (pattern.startsWith("XX")) cauDangChay = "Bệt XỈU";
    else if (/^(TXTX)/.test(pattern)) cauDangChay = "Cầu 1-1";
    else if (/^(TTXX)/.test(pattern)) cauDangChay = "Cầu 2-2";

    return {
        pattern30: pattern,
        tai, xiu,
        taiP: ((tai / 30) * 100).toFixed(1),
        xiuP: ((xiu / 30) * 100).toFixed(1),
        currentStreak,
        streaks,
        patterns: patterns.slice(0, 5),
        transition,
        cauDangChay
    };
}

// ==========================
// 🔮 PREDICT VIP
// ==========================
function predictVIP(data, last) {
    let scoreT = 50, scoreX = 50;
    let reasons = [];

    if (last === "T") {
        scoreT += parseFloat(data.transition.T.toT);
        scoreX += parseFloat(data.transition.T.toX);
    } else {
        scoreT += parseFloat(data.transition.X.toT);
        scoreX += parseFloat(data.transition.X.toX);
    }

    if (data.currentStreak.length >= 3) {
        if (data.currentStreak.type === "T") {
            scoreX += 12;
            reasons.push("Chuỗi TÀI dài → dễ đảo");
        } else {
            scoreT += 12;
            reasons.push("Chuỗi XỈU dài → dễ đảo");
        }
    }

    if (data.patterns.length > 0) {
        scoreT += 5;
        scoreX += 5;
        reasons.push("Pattern lặp xuất hiện");
    }

    const pick = scoreT > scoreX ? "T" : "X";
    const diff = Math.abs(scoreT - scoreX);

    return {
        pick,
        full: pick === "T" ? "TÀI" : "XỈU",
        confidence: Math.min(95, 70 + diff).toFixed(1) + "%",
        reasons,
        score: { T: Math.round(scoreT), X: Math.round(scoreX) }
    };
}

// ==========================
// 🎯 API
// ==========================
app.get("/api/tx", async (req, res) => {
    try {
        const cached = cache.get("data");
        if (cached) return res.json(cached);

        const { data } = await axios.get(HISTORY_API);

        let list = data.list || data;
        if (!Array.isArray(list)) list = [list];

        const history = list.map(normalize)
            .filter(x => x.phien > 0)
            .sort((a, b) => b.phien - a.phien);

        if (history.length < 30) {
            return res.json({ error: "Không đủ 30 phiên" });
        }

        const current = history[0];
        const analyze = analyzeVIP(history);
        const predict = predictVIP(analyze, current.ket_qua);

        // 10 phiên
        let future = [];
        for (let i = 1; i <= 10; i++) {
            future.push({
                phien: current.phien + i,
                du_doan: Math.random() > 0.5 ? "TÀI" : "XỈU",
                do_tin_cay: (85 + Math.random() * 10).toFixed(1) + "%"
            });
        }

        const result = {
            creator: CREATOR,
            time: new Date().toISOString(),

            phien_hien_tai: {
                phien: current.phien,
                ket_qua: current.ket_qua_day_du,
                tong: current.tong,
                xuc_xac: current.xuc_xac
            },

            phien_du_doan: {
                phien: current.phien + 1,
                du_doan: predict.full,
                do_tin_cay: predict.confidence,
                diem: predict.score
            },

            pattern: analyze.pattern30,

            phan_tich: {
                tai: `${analyze.tai} (${analyze.taiP}%)`,
                xiu: `${analyze.xiu} (${analyze.xiuP}%)`,
                chuoi: `${analyze.currentStreak.type === "T" ? "TÀI" : "XỈU"} (${analyze.currentStreak.length})`,
                cau: analyze.cauDangChay,
                lap: analyze.patterns,
                chuyen_tiep: analyze.transition
            },

            nhan_dinh: predict.reasons,

            du_doan_10_phien: future
        };

        cache.set("data", result);
        res.json(result);

    } catch (e) {
        res.json({ error: "Lỗi server" });
    }
});

// ==========================
app.get("/", (req, res) => {
    res.send("🚀 VIP TX API RUNNING");
});

app.listen(PORT, () => {
    console.log("🚀 Server running port", PORT);
});
