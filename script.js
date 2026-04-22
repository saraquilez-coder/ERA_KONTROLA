let tarjetaAbierta = -1; // -1 significa que ninguna tarjeta está abierta al empezar
let intervencion = JSON.parse(localStorage.getItem('bvg_int_data')) || null;
let eqs = JSON.parse(localStorage.getItem('eq_bvg_timer_fix')) || [];
let idS = -1; 
let audioCtx = null;

// Registro PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
    });
}

function manejarHistorial() { history.pushState({page: "activo"}, "", ""); }
manejarHistorial();

window.addEventListener('popstate', function(event) {
    if (intervencion) {
        if (confirm("¿Seguro que quieres salir? Se perderán los datos activos.")) {
        } else { manejarHistorial(); }
    }
});

window.addEventListener('beforeunload', (e) => {
    if (intervencion) { e.preventDefault(); e.returnValue = ''; }
});

function iniciarIntervencion() {
    let n = document.getElementById('int-nom').value;
    let d = document.getElementById('int-dir').value;
    if(!n) return;
    intervencion = { nombre: n, direccion: d };
    localStorage.setItem('bvg_int_data', JSON.stringify(intervencion));
    manejarHistorial();
    checkActiva();
}

function checkActiva() {
    if(intervencion) {
        document.getElementById('setup-intervencion').style.display='none';
        document.getElementById('panel-control').style.display='block';
        document.getElementById('display-intervencion').style.display='block';
        document.getElementById('txt-int-nom').innerText = intervencion.nombre.toUpperCase();
        document.getElementById('txt-int-dir').innerText = intervencion.direccion.toUpperCase();
        render();
    } else {
        document.getElementById('setup-intervencion').style.display='block';
        document.getElementById('panel-control').style.display='none';
        document.getElementById('display-intervencion').style.display='none';
    }
}

function finalizarTodo() {
    if(confirm("¿FINALIZAR INTERVENCIÓN TOTAL? Se guardará en el historial y se reseteará la App.")) {
        let historial = JSON.parse(localStorage.getItem('bvg_historial')) || [];
        
        // Aquí es donde ocurre la magia: guardamos TODO el array 'eqs' de golpe
        historial.push({
            id: Date.now(),
            info: JSON.parse(JSON.stringify(intervencion)),
            equipos: JSON.parse(JSON.stringify(eqs)), 
            fecha: new Date().toLocaleString()
        });
        localStorage.setItem('bvg_historial', JSON.stringify(historial));

        // Limpieza y reseteo
        localStorage.removeItem('bvg_int_data');
        localStorage.removeItem('eq_bvg_timer_fix');
        intervencion = null; eqs = [];
        window.location.href = window.location.origin + window.location.pathname;
    }
}

function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playAlertSound() {
    initAudio();
    let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'square'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

function formatHora(f) { 
    let d = new Date(f); 
    return d.getHours().toString().padStart(2,'0') + ":" + d.getMinutes().toString().padStart(2,'0'); 
}

function formatTimeMS(ms) { return Math.floor(ms/60000) + "m " + Math.floor((ms%60000)/1000) + "s"; }


function addEquipo() {
    initAudio();
    let n = document.getElementById('nom').value; 
    let b = document.getElementById('bar').value;
    if(!n || !b) return;

    let p = [
        document.getElementById('np1').value || "-", 
        document.getElementById('np2').value || "-", 
        document.getElementById('np3').value || "-"
    ];
    
    let ah = Date.now(); 
    let barNum = parseInt(b);

    eqs.push({ 
        n: n, pE: barNum, pA: barNum, prof: p, 
        sit: document.getElementById('sit').value || "---", 
        obj: document.getElementById('obj').value || "---",
        hE: formatHora(ah), 
        hS55: formatHora(ah + (((barNum-50)*6/55)*60000)), 
        hSMed: "--:--", 
        hSalida: "--:--",
        pSegReg: Math.round((barNum / 2) + 25),
        tI: ah, 
        tU: ah, 
        hUltActualizacion: formatHora(ah), // <--- ESTA LÍNEA ARREGLA EL UNDEFINED
        tAcumuladoPrevio: 0, 
        rMed: 0,  
        autMed: 0, 
        activo: true, 
        alerta: false, 
        silenciado: false, 
        informadoRegreso: false,
        tramos: [] 
    });

    sync(); 
    render();
    ["nom","bar","np1","np2","np3","sit","obj"].forEach(id => document.getElementById(id).value="");
}

function render() {
    if(!intervencion) return;
    let hZ = ""; let hF = ""; let hJump = ""; let ah = Date.now();
    let cS = false; let cV = false;

    eqs.forEach((e, i) => {
        let tAct = e.activo ? (ah - e.tI) : 0; 
        let minT = Math.floor(tAct / 60000);
        let sU = Math.floor((ah - e.tU)/1000); 
        let preA = e.alerta;

        // Lógica de alarmas original
        let alertaMinutos = [5,10,15,20].includes(minT) && sU > 55;
        let alertaReserva = e.pA <= 50;
        let avisoRegreso = (e.pA <= e.pSegReg) && !e.informadoRegreso;
        e.alerta = e.activo && (alertaMinutos || alertaReserva || avisoRegreso);

        if (e.alerta) { 
            cV = true; 
            if (!e.silenciado) cS = true; 
            if (!preA) { e.silenciado = false; } 
        }

        // --- LÓGICA DE CÍRCULO Y COLORES SOLICITADA ---
        let porcentaje = (e.pA / 300) * 100; // 300 bar = 100%
        if (porcentaje > 100) porcentaje = 100;
        if (porcentaje < 0) porcentaje = 0;

        let colorDinamico = "#d32f2f"; // Rojo por defecto (<50 bar)
        if (e.pA > 200) {
            colorDinamico = "#2ecc71"; // Verde (>200 bar)
        } else if (e.pA > 100) {
            colorDinamico = "#e67e22"; // Naranja (100-200 bar)
        } else if (e.pA > 50) {
            colorDinamico = "#f1c40f"; // Amarillo (50-100 bar)
        }

        let estiloCarga = `background: conic-gradient(${colorDinamico} ${porcentaje}%, #eeeeee 0%);`;

        if (e.activo) hJump += `<div class="btn-jump" onclick="toggleDetalles(${i})">${e.n} ${e.alerta?'⚠️':''}</div>`;

        // Solo se añade 'mostrar' si coincide con la tarjeta pulsada
        let claseM = (tarjetaAbierta === i) ? 'mostrar' : '';

        let cardHtml = `
            <div class="card-equipo" onclick="toggleDetalles(${i})" style="border-left-color: ${colorDinamico}">
                <div class="card-header-resumen">
                    <div class="circulo-presion" style="${estiloCarga}">
                        <span style="font-size: 1.3rem;">${Math.round(e.pA)}</span>
                        <span style="font-size: 0.6rem; color: #666;">BAR</span>
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: bold; font-size: 1.1rem; color: #333;">${e.n}</div>
                        <div style="color: #666; font-size: 0.85rem;">📍 ${e.sit.toUpperCase()}</div>
                        <div style="font-size: 0.85rem; margin-top: 4px;">
                            Prev. Salida: <b style="color:red">${e.hS55}</b> | Seg: <b>${Math.round(e.pSegReg)} bar</b>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.7rem; color: #999;">TIEMPO</div>
                        <div style="font-weight: bold; font-size: 1.1rem; font-family: monospace;">${formatTimeMS(tAct)}</div>
                    </div>
                </div>
                <div id="detalles-${i}" class="detalles-expandidos ${claseM}">
                    ${e.alerta ? `<div style="background:#ffebee; color:#c62828; padding:8px; border-radius:5px; margin-bottom:10px; font-size:0.8rem; font-weight:bold; text-align:center;">⚠️ REVISIÓN REQUERIDA</div>` : ''}
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; color: #444;">
                        <div><b>Entrada:</b> ${e.hE} (${Math.round(e.pE)} bar)</div>
                        <div><b>Consumo:</b> ${Math.round(e.rMed)} l/min</div>
                        <div><b>Última:</b> ${e.hUltActualizacion}</div>
                        <div><b>Media:</b> ${e.hSMed}</div>
                        <div style="grid-column: span 2;"><b>Personal:</b> ${e.prof.filter(p=>p!=="-").join(" | ")}</div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        ${e.activo ? `
                            <button class="btn btn-orange" style="flex:1" onclick="event.stopPropagation(); showModal(${i})">ACTUALIZAR</button>
                            ${e.alerta ? `<button class="btn btn-silence" style="flex:1" onclick="event.stopPropagation(); eqs[${i}].silenciado=true; render();">SILENCIAR</button>` : ''}
                            <button class="btn btn-dark" style="flex:1" onclick="event.stopPropagation(); setEstado(${i}, false)">FIN EQUIPO</button>
                        ` : `
                            <button class="btn btn-blue" style="flex:1; background:#28a745" onclick="event.stopPropagation(); reactivarEquipo(${i})">RE-ACTIVAR</button>
                        `}
                    </div>
                </div>
            </div>`;
        if(e.activo) hZ += cardHtml; else hF += cardHtml;
    });

    document.getElementById('quick-access').innerHTML = hJump;
    document.getElementById('L_ZONA').innerHTML = hZ;
    document.getElementById('L_FUERA').innerHTML = hF != "" ? `<div class="separador" style="background:#28a745; color:white; margin-top:30px; padding:10px; border-radius:8px; text-align:center;">EQUIPOS FUERA DE ZONA</div>${hF}` : "";

    let tB = document.getElementById('timer-box');
    if (cV) { tB.className = 'global-alerta'; tB.innerText = '¡CONTROL PENDIENTE!'; if (cS && ah % 2000 < 1000) playAlertSound(); } else { tB.className = ''; tB.innerText = ''; }

    let zonaBoton = document.getElementById('contenedor-fijo-finalizar');
    if (!zonaBoton) { zonaBoton = document.createElement('div'); zonaBoton.id = 'contenedor-fijo-finalizar'; document.body.appendChild(zonaBoton); }
    if (eqs && eqs.length > 0) {
        zonaBoton.innerHTML = `<div style="margin: 40px 15px 30px 15px; text-align: center;"><button class="btn btn-reset" onclick="finalizarTodo()" style="background-color: #d32f2f !important; width: 100%; height: 65px; font-weight: bold; font-size: 1.2rem; color: white; border: 3px solid #ffffff; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer; display: block;">FINALIZAR INTERVENCIÓN</button></div>`;
    } else { zonaBoton.innerHTML = ""; }
}


function reactivarEquipo(i) {
    let b = prompt(`Bares Entrada:`, Math.round(eqs[i].pA));
    if(b) {
        let ah = Date.now();
        eqs[i].pE = eqs[i].pA = parseInt(b);
        eqs[i].tI = ah; 
        eqs[i].tU = ah; 
        eqs[i].hE = formatHora(ah);
        eqs[i].hUltActualizacion = formatHora(ah); // Reiniciamos hora de actualización
        eqs[i].hSalida = "--:--";
        eqs[i].activo = true; 
        eqs[i].informadoRegreso = false;
        
        // NO ponemos tAcumuladoPrevio a cero para que el tiempo total no se borre
        
        sync(); 
        render();
    }
}

function showModal(i) { 
    idS = i; 
    let e = eqs[i];
    document.getElementById('mTit').innerText = e.n; 
    document.getElementById('nB').value = Math.round(e.pA); 
    document.getElementById('nSit').value = e.sit; 
    document.getElementById('nObj').value = e.obj;
    
    // Carga los nombres actuales en los 3 cuadritos nuevos
    document.getElementById('nnp1').value = e.prof[0] !== "-" ? e.prof[0] : "";
    document.getElementById('nnp2').value = e.prof[1] !== "-" ? e.prof[1] : "";
    document.getElementById('nnp3').value = e.prof[2] !== "-" ? e.prof[2] : "";

    let alertaReg = e.pA <= e.pSegReg;
    document.getElementById('alerta-check-container').style.display = alertaReg ? 'block' : 'none';
    document.getElementById('checkInformado').checked = e.informadoRegreso;

    document.getElementById('modal').style.display = 'flex'; 
}


function hideModal() { document.getElementById('modal').style.display='none'; }


function saveData() {
    let b = document.getElementById('nB').value;
    if (b !== "" && idS !== -1) {
        let ah = Date.now(); 
        let v = parseInt(b);
        let e = eqs[idS];

        // 1. Actualizamos la hora de actualización SIEMPRE
        e.hUltActualizacion = formatHora(ah); 
        e.tU = ah; 

        // 2. Cálculos de consumo (Solo si cambia la presión)
        if (v !== e.pA) {
            let tTotal = (ah - e.tI) / 60000;
            if (tTotal > 0.1) {
                e.rMed = ((e.pE - v) * 6) / tTotal;
                if (e.rMed > 0) {
                    e.autMed = ((v - 50) * 6) / e.rMed;
                    e.hSMed = formatHora(ah + (e.autMed * 60000));
                }
            }
            // HE ELIMINADO LA LÍNEA DE e.rInst QUE ESTABA AQUÍ
            e.pA = v;
        }

        // 3. ACTUALIZAR ESTADO DE ALARMA
        e.informadoRegreso = document.getElementById('checkInformado').checked;
        
        if (e.informadoRegreso) {
            e.alerta = false;   
            e.silenciado = true; 
        }

        // 4. Guardar los nombres de los intervinientes (NP1, NP2, NP3)
        e.prof = [
            document.getElementById('nnp1').value || "-",
            document.getElementById('nnp2').value || "-",
            document.getElementById('nnp3').value || "-"
        ];

        e.sit = document.getElementById('nSit').value; 
        e.obj = document.getElementById('nObj').value;
        
        hideModal(); 
        sync(); 
        render();
    }
}

function sync() { localStorage.setItem('eq_bvg_timer_fix', JSON.stringify(eqs)); }

function toggleHistorial() {
    const div = document.getElementById('seccion-historial');
    div.style.display = (div.style.display === 'none') ? 'block' : 'none';
    if(div.style.display === 'block') renderHistorial();
}

function renderHistorial() {
    let historial = JSON.parse(localStorage.getItem('bvg_historial')) || [];
    let html = "";
    historial.slice().reverse().forEach((reg, index) => {
        let originalIdx = historial.length - 1 - index;
        html += `
            <div style="background:white; padding:10px; margin-bottom:10px; color:black; border-radius:5px; border-left:5px solid #d32f2f; display:flex; justify-content:space-between; align-items:center;">
                <div><b>${reg.fecha}</b><br>${reg.info.nombre.toUpperCase()}</div>
                <button class="btn btn-blue" style="width:auto; padding:5px 10px; font-size:0.7rem;" onclick="descargarIntervencion(${originalIdx})">EXCEL</button>
            </div>`;
    });
    document.getElementById('lista-historial').innerHTML = html || "No hay intervenciones.";
}

function descargarIntervencion(idx) {
    let historial = JSON.parse(localStorage.getItem('bvg_historial')) || [];
    let reg = historial[idx];
    if(!reg) return;

    // Cabeceras del Excel
    let columnas = ["Fecha", "Intervención", "Dirección", "Equipo", "Profesionales", "Localización", "Objetivo", "Entrada", "Salida", "P. Inicial", "P. Final", "Consumo bar", "Consumo Medio", "Tiempo Trabajo"];
    let csvContent = columnas.join(";") + "\n";

    // Recorremos los equipos y, de cada equipo, sus tramos (reactivaciones)
    reg.equipos.forEach(equipoPrincipal => {
        if (equipoPrincipal.tramos && equipoPrincipal.tramos.length > 0) {
            equipoPrincipal.tramos.forEach(t => {
                let fila = [
                    reg.fecha,
                    reg.info.nombre,
                    reg.info.direccion,
                    t.n,
                    t.prof.filter(p => p !== "-").join("/"),
                    t.sit,
                    t.obj,
                    t.hE,
                    t.hSalida,
                    t.pE,
                    t.pA,
                    (t.pE - t.pA),
                    Math.round(t.rMed),
                    formatTimeMS(t.tAcumuladoPrevio)
                ].join(";");
                csvContent += fila + "\n";
            });
        }
    });

    let BOM = "\uFEFF";
    let blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
 let link = document.createElement("a");
    
    // Obtenemos el nombre de la intervención y limpiamos espacios raros
    let nombreLimpio = reg.info.nombre.replace(/ /g, "_");
    
    // Configuramos el nombre del archivo: Intervencion_Nombre.csv
    link.setAttribute("download", `Intervencion_${nombreLimpio}.csv`);
    
    link.setAttribute("href", url);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function toggleDetalles(index) {
    if (tarjetaAbierta === index) {
        tarjetaAbierta = -1; // Si ya estaba abierta, se cierra
    } else {
        tarjetaAbierta = index; // Si no, se guarda cuál abrir
    }
    render(); // Redibuja inmediatamente para que el cambio sea instantáneo
}

setInterval(render, 1000);
window.onload = checkActiva;
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });

