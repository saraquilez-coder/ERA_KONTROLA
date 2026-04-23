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
    activarMantenerPantalla();
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
        document.getElementById('display-intervencion').style.display='block';
        document.getElementById('resumen-binomios').style.display = 'flex';
               
        if(document.getElementById('contenedor-historial-btn')) {
            document.getElementById('contenedor-historial-btn').style.display = 'none';
        }
        

        document.getElementById('btn-abrir-container').style.display='block';
        
        document.getElementById('txt-int-nom').innerText = intervencion.nombre.toUpperCase();
        if(intervencion.direccion) document.getElementById('txt-int-dir').innerText = intervencion.direccion.toUpperCase();
        
        render();
    } else {
        document.getElementById('setup-intervencion').style.display='block';
        document.getElementById('display-intervencion').style.display='none';
        
        // --- Y ESTO TAMBIÉN ---
        if(document.getElementById('contenedor-historial-btn')) {
            document.getElementById('contenedor-historial-btn').style.display = 'block';
        }
        // ----------------------

        document.getElementById('btn-abrir-container').style.display='none';
        document.getElementById('panel-control').style.display='none';
    }
}

function finalizarTodo() {
    if(confirm("¿FINALIZAR INTERVENCIÓN TOTAL? Se guardará en el historial y se reseteará la App.")) {
        try {
            let ahora = Date.now();
            
            // 1. BARRIDO SEGURO: Cerramos equipos sin usar setEstado ni render()
            eqs.forEach(e => {
                if (e.activo) {
                    e.activo = false;
                    e.hSalida = formatHora(ahora);
                    e.tTramo = ahora - e.tI;
                    e.tAcumuladoPrevio += (ahora - e.tI);
                    if (!e.tramos) e.tramos = [];
                    e.tramos.push(JSON.parse(JSON.stringify(e)));
                }
            });

            // 2. GUARDADO EN HISTORIAL
            let historial = JSON.parse(localStorage.getItem('bvg_historial')) || [];
            historial.push({
                id: ahora,
                info: intervencion ? JSON.parse(JSON.stringify(intervencion)) : { nombre: "SIN NOMBRE", direccion: "" },
                equipos: JSON.parse(JSON.stringify(eqs)), 
                fecha: new Date().toLocaleString()
            });
            localStorage.setItem('bvg_historial', JSON.stringify(historial));

            // 3. LIMPIEZA
            localStorage.removeItem('bvg_int_data');
            localStorage.removeItem('eq_bvg_timer_fix');
            intervencion = null; 
            eqs = [];

            // 4. RECARGA LIMPIA DE LA PÁGINA
            location.reload();

        } catch (error) {
            // Si algo falla, la app no se quedará congelada en silencio. 
            // Te mostrará una alerta con el motivo exacto del error.
            alert("Error al finalizar: " + error.message);
            console.error("Fallo completo:", error);
        }
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

    // CÁLCULO DE MINUTOS DE AUTONOMÍA (55 L/MIN) DESDE EL INICIO
    let minutos55 = Math.round(((barNum - 50) * 6) / 55);

    // Dentro de addEquipo, busca esta línea y déjala así:
       

    eqs.push({ 
        n: n, 
        pE: barNum, 
        pA: barNum, 
        prof: p, 
        sit: document.getElementById('sit').value || "---", 
        obj: document.getElementById('obj').value || "---",
        hE: formatHora(ah), 
        
        // GUARDAMOS EL DATO DE MINUTOS PARA MOSTRARLO EN LA TARJETA
        aut55: minutos55,
        hS55: formatHora(ah + (minutos55 * 60000)), 
        
        hSMed: "--:--", 
        hSalida: "--:--",
        pSegReg: Math.round((barNum / 2) + 20),
        tI: ah, 
        tU: ah, 
        hUltActualizacion: formatHora(ah),
        tAcumuladoPrevio: 0, 
        rMed: 0,  
        autMed: 0, 
        activo: true, 
        alerta: false, 
        silenciado: false, 
        informadoRegreso: false,
        tramos: [],
        ultimoMinutoControlado: -1,
    });

    sync(); 
    render();
    
    // Ocultar formulario y mostrar botón azul de nuevo
    document.getElementById('panel-control').style.display = 'none';
    document.getElementById('btn-abrir-container').style.display = 'block';

    // Limpiar casillas
    ["nom","bar","np1","np2","np3","sit","obj"].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.value = "";
    });
}


function render() {
    
    // CÁLCULO DE LOS CONTADORES
    let nTotal = eqs.length;
    let nActivos = eqs.filter(e => e.activo).length;
    let nFuera = nTotal - nActivos;

    // Actualizamos los números en los cuadros del HTML
    if (document.getElementById('count-total')) {
        document.getElementById('count-total').innerText = nTotal;
        document.getElementById('count-activos').innerText = nActivos;
        document.getElementById('count-fuera').innerText = nFuera;
    }

    if (!intervencion) return;
    let hZ = ""; let hF = ""; let hJump = ""; let ah = Date.now();
    let cS = false; let cV = false;

    eqs.forEach((e, i) => {
        let tAct = e.activo ? (ah - e.tI) : 0;
        let tiempoTotalTrabajo = e.tAcumuladoPrevio + tAct;
        let minT = Math.floor(tAct / 60000);
        let sU = Math.floor((ah - e.tU) / 1000);
        let preA = e.alerta;

        // --- 1. LÓGICA DE ALARMAS ---
        let alertaMinutos = [5, 10, 15, 20].includes(minT) && (e.ultimoMinutoControlado !== minT);
        let alertaReserva = e.pA <= 50;
        let avisoRegreso = (e.pA <= e.pSegReg) && !e.informadoRegreso;
        
        e.alerta = e.activo && (alertaMinutos || alertaReserva || avisoRegreso);

        let msjAlerta = "";
        if (alertaReserva) {
            msjAlerta = "⚠️ EQUIPO EN RESERVA - SALIR INMEDIATAMENTE";
        } else if (avisoRegreso) {
            msjAlerta = "⚠️ PRESIÓN DE SEGURIDAD ALCANZADA - INFORME A EQUIPO";
        } else if (alertaMinutos) {
            msjAlerta = `⚠️ CONTROL NECESARIO ${minT} MINUTOS`;
        }

        if (e.alerta) {
            cV = true;
            if (!e.silenciado) cS = true;
            if (!preA) { e.silenciado = false; }
        }

        // --- LÓGICA DE PARPADEO DEL FONDO DE LA TARJETA ---
        let claseParpadeo = "";
        if (e.alerta && !e.silenciado) { 
            // Si hay una alerta activa y no la hemos silenciado
            if (alertaReserva || avisoRegreso) {
                claseParpadeo = "fondo-alerta-roja";
            } else if (alertaMinutos) {
                claseParpadeo = "fondo-alerta-amarilla";
            }
        }

        // --- 2. LÓGICA DE CÍRCULO DINÁMICO ---
        let porcentaje = (e.pA / 300) * 100;
        if (porcentaje > 100) porcentaje = 100;
        if (porcentaje < 0) porcentaje = 0;

        let colD = "#d32f2f"; 
        if (e.pA > 200) colD = "#2ecc71"; 
        else if (e.pA > 100) colD = "#e67e22"; 
        else if (e.pA > 50) colD = "#f1c40f"; 

        let estiloC = `background: conic-gradient(${colD} ${porcentaje}%, #d1d1d1 0%);`;

        if (e.activo) hJump += `<div class="btn-jump" onclick="toggleDetalles(${i})">${e.n} ${e.alerta ? '⚠️' : ''}</div>`;

        let claseM = (tarjetaAbierta === i) ? 'mostrar' : '';

        let botonSilenciar = "";
        if (e.activo && e.alerta) {
            botonSilenciar = `<button class="btn" style="flex:1; min-width:60px; background:#5d6d7e; color:white; font-size:1.2rem;" onclick="event.stopPropagation(); eqs[${i}].silenciado=true; render();">🔇</button>`;
        }

        let cardHtml = `
           <div class="card-equipo ${claseParpadeo}" onclick="toggleDetalles(${i})" style="border-left-color: ${colD}; background-color: ${e.activo ? '' : '#6ddf7357'}; color: ${e.activo ? '' : 'white'};">
                 <div class="card-header-resumen">
                    <div class="circulo-presion" style="${estiloC} width: 80px; height: 80px; min-width: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative;">
                        <div style="position: absolute; width: 66px; height: 66px; background: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <span style="font-size: 1.6rem; font-weight: bold; line-height: 1; color: #333;">${Math.round(e.pA)}</span>
                            <span style="font-size: 0.65rem; color: #666; font-weight: bold;">BAR</span>
                        </div>
                    </div>
                    
                    <div style="margin-left: auto; text-align: right; padding-top: 5px;">
                        <div style="font-size: 0.65rem; color: #999; font-weight: bold; line-height: 1;">TIEMPO SESIÓN</div>
                        <div style="font-weight: bold; font-size: 1.2rem; font-family: monospace; color: #2c3e50;">${formatTimeMS(tAct)}</div>
                    </div>
                    <div style="flex-basis: 100%; margin-top: 10px;">
                        <div style="font-weight: bold; font-size: 1.1rem; color: #333;">${e.n}</div>
                        <div style="color: #666; font-size: 0.85rem;font-weight: bold;"> ⚲ ${e.sit.toUpperCase()}</div>
                        <div style="color: #666; font-size: 0.85rem; font-weight: bold;"> ◎ OBJETIVO: ${e.obj.toUpperCase()}</div>
                        <div style="color: #666; font-size: 0.85rem; font-weight: bold;"> ⛑︎ Personal: ${e.prof.filter(p => p !== "-").join(" | ")}</div>
                        
                        <div style="font-size: 0.85rem; margin-top: 4px;">
                            Previsión Salida (55l/min): <b style="color:red">${e.hS55}h</b> 
                        </div>  
                            
                        <div style="font-size: 0.85rem; margin-top: 4px;">
                        Previsión Salida (Consumo Medio): <b style="color:red">${e.hSMed}h</b>
                        </div>
                        
                        <div style="font-size: 0.85rem; margin-top: 4px;">
                             Presión Seguridad Retorno: <b style="color:red">${Math.round(e.pSegReg)} bar</b>
                        </div>
                    </div>
                    
                </div>
                
                <div id="detalles-${i}" class="detalles-expandidos ${claseM}">
                    ${e.alerta ? `<div style="background:#ffebee; color:#c62828; padding:8px; border-radius:5px; margin-bottom:10px; font-size:0.8rem; font-weight:bold; text-align:center;">${msjAlerta}</div>` : ''}
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; color: #444;">
                        <div><b>Hora Entrada:</b> ${e.hE} (${Math.round(e.pE)} bar)</div>
                        <div><b>Consumo medio:</b> ${Math.round(e.rMed)} l/min</div>
                        <div><b>Última Actualización Presión:</b> ${e.hUltActualizacion}h</div>
                        <div><b>Autonomía (consumo medio):</b> ${e.autMed ? Math.round(e.autMed) + ' min' : '---'} </div>
                        <div><b>Tiempo Trabajo Acumulado:</b> ${formatTimeMS(tiempoTotalTrabajo)}</div>
                        <div><b>Autonomía (55 l/min):</b> ${e.aut55 > 0 ? Math.round(e.aut55) + ' min' : '0 min'}</div>
                    </div>

                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px;">
                        ${e.activo ? 
                            `<button class="btn btn-orange" style="flex:2; min-width:80px;" onclick="event.stopPropagation(); showModal(${i})">ACTUALIZAR</button>
                             ${botonSilenciar}
                             <button class="btn btn-dark" style="flex:2; min-width:80px;" onclick="event.stopPropagation(); setEstado(${i}, false)">FIN EQUIPO</button>` 
                            : 
                            `<button class="btn btn-blue" style="flex:1; background:#28a745" onclick="event.stopPropagation(); reactivarEquipo(${i})">RE-ACTIVAR</button>`
                        }
                    </div>
                </div>
            </div>`;

        if (e.activo) hZ += cardHtml; else hF += cardHtml;
    });

    document.getElementById('L_ZONA').innerHTML = hZ;
    document.getElementById('L_FUERA').innerHTML = hF !== "" ? `<div class="separador" style="background:#28a745; color:white; margin-top:80px; margin-bottom:30px; padding:10px; border-radius:8px; text-align:center; font-weight:bold;">EQUIPOS FUERA DE ZONA</div>${hF}` : "";

    // --- LÓGICA DE ALERTA GLOBAL ---
    let tB = document.getElementById('timer-box');
    if (cV) {
        tB.className = 'global-alerta';
        tB.innerText = '¡CONTROL PENDIENTE!';
        if (cS && ah % 2000 < 1000) playAlertSound();
    } else {
        tB.className = '';
        tB.innerText = '';
    }

    // --- BOTÓN FINALIZAR INTERVENCIÓN ---
    let zonaBoton = document.getElementById('contenedor-fijo-finalizar');
    if (!zonaBoton) {
        zonaBoton = document.createElement('div');
        zonaBoton.id = 'contenedor-fijo-finalizar';
        document.body.appendChild(zonaBoton);
    }
    // NUEVO CÓDIGO: El botón sale SIEMPRE que haya una intervención activa
    zonaBoton.innerHTML = `<div style="margin: 40px 15px 30px 15px; text-align: center;"><button class="btn btn-reset" onclick="finalizarTodo()" style="background-color: #d32f2f !important; width: 100%; height: 65px; font-weight: bold; font-size: 1.2rem; color: white; border: 3px solid #ffffff; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer; display: block;">FINALIZAR INTERVENCIÓN</button></div>`;
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
    
    if (idS !== -1) { 
        let e = eqs[idS];
        let ah = Date.now(); 

        // ====================================================================
        // 1. ESTO SE GUARDA SIEMPRE (Localización, Objetivo, Intervinientes)
        // ====================================================================
        e.sit = document.getElementById('nSit').value; 
        e.obj = document.getElementById('nObj').value;
        e.prof = [
            document.getElementById('nnp1').value || "-",
            document.getElementById('nnp2').value || "-",
            document.getElementById('nnp3').value || "-"
        ];

        // ====================================================================
        // 2. SOLO SE GUARDA SI HAY NÚMERO Y ES DISTINTO A LA PRESIÓN ANTERIOR
        // ====================================================================
        if (b !== "" && parseInt(b) !== e.pA) {
            let v = parseInt(b); 
            
            e.hUltActualizacion = formatHora(ah); 
            e.tU = ah; 
            e.hAct = formatHora(ah);       
            e.tUltimaAct = ah;             

            let minActual = Math.floor((ah - e.tI) / 60000);
            e.ultimoMinutoControlado = minActual;
            
            e.alerta = false;
            e.silenciado = true;

            if (!e.activo) {
                e.tI = ah;
                e.hE = formatHora(ah);
                e.pE = v; 
                e.activo = true;
                e.informadoRegreso = false;
                e.silenciado = false;
                e.alerta = false;
                e.rMed = 0;
                e.autMed = 0;     
                e.hSMed = "--:--"; 
                e.ultimoMinutoControlado = -1;
                e.pSegReg = Math.round((v / 2) + 20);
                document.getElementById('checkInformado').checked = false;
            }

            let litrosDisponibles = Math.max(0, (v - 50) * 6);
            let minutos55 = litrosDisponibles / 55;
            e.aut55 = minutos55; 
            e.hS55 = formatHora(ah + (minutos55 * 60000));

            let tTotalMinutos = (ah - e.tI) / 60000;
            if (tTotalMinutos > 0.1) {
                let litrosConsumidos = (e.pE - v) * 6;
                let consumoCalculado = litrosConsumidos / tTotalMinutos;
                if (consumoCalculado > 0) {
                    e.rMed = consumoCalculado;
                    e.autMed = litrosDisponibles / e.rMed;
                    e.hSMed = formatHora(ah + (e.autMed * 60000));
                } else {
                    e.rMed = 0; e.autMed = 0; e.hSMed = "---";
                }
            }
            
            e.pA = v;

            let checkCont = document.getElementById('alerta-check-container');
            if (checkCont && checkCont.style.display !== 'none') {
                e.informadoRegreso = document.getElementById('checkInformado').checked;
                if (e.informadoRegreso) {
                    e.alerta = false;
                    e.silenciado = true;
                }
            }
        } 
        // ====================================================================

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
                    formatTimeMS(t.tTramo || 0)
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

function toggleFormulario() {
    const panel = document.getElementById('panel-control');
    const btn = document.getElementById('btn-abrir-container');
    if (panel.style.display === "none" || panel.style.display === "") {
        panel.style.display = "block";
        btn.style.display = "none";
    } else {
        panel.style.display = "none";
        btn.style.display = "block";
    }
}

// --- FUNCIÓN PARA FINALIZAR UN EQUIPO MANUALMENTE ---
function setEstado(i, activo) { 
    if (!activo) {

        // 1. Pedimos la presión.
        let pFinal = prompt("Introduzca PRESIÓN DE SALIDA para " + eqs[i].n, Math.round(eqs[i].pA));
        
        // 2. SOLO actualizamos si el usuario ha escrito un número y ha dado a OK.
        // Si pulsa CANCELAR, pFinal es null. Al no entrar en este IF, 
        // el equipo mantiene su presión actual intacta y el código SIGUE adelante.
        if (pFinal !== null && pFinal !== "") {
            let num = parseInt(pFinal);
            if (!isNaN(num)) {
                eqs[i].pA = num;
            }
        }

        let ahora = Date.now();
        
        // Asignamos la hora de salida
        eqs[i].hSalida = formatHora(ahora); 

        // Correccion para que no haga un acumulado en la REACTIVACION
        eqs[i].tTramo = ahora - eqs[i].tI;
        
        // Sumamos el tiempo que han estado dentro al acumulado
        eqs[i].tAcumuladoPrevio += (ahora - eqs[i].tI);
        
        // Marcamos el equipo como inactivo (sale a la zona verde de fuera)
        eqs[i].activo = false;
        
        // Guardamos este tramo para el historial
        if(!eqs[i].tramos) eqs[i].tramos = [];
        eqs[i].tramos.push(JSON.parse(JSON.stringify(eqs[i])));
        
        // Cerramos la tarjeta desplegable
        tarjetaAbierta = -1;
    }
    sync(); 
    render(); 
}

function reactivarEquipo(i) {
    idS = i; // Esto es vital para que saveData sepa qué equipo actualizar
    let e = eqs[i];
    
    // Configuramos el modal
    document.getElementById('mTit').innerText = "RE-ENTRADA: " + e.n;
    document.getElementById('nB').value = ""; // Forzamos a que metas la presión nueva
    document.getElementById('nSit').value = e.sit;
    document.getElementById('nObj').value = e.obj;
    document.getElementById('nnp1').value = e.prof[0] === "-" ? "" : e.prof[0];
    document.getElementById('nnp2').value = e.prof[1] === "-" ? "" : e.prof[1];
    document.getElementById('nnp3').value = e.prof[2] === "-" ? "" : e.prof[2];

    // --- LIMPIA EL MODAL AL REACTIVAR ---
    document.getElementById('alerta-check-container').style.display = 'none';
    document.getElementById('checkInformado').checked = false;
    
    // Abrimos el modal
    document.getElementById('modal').style.display = 'flex';
}

let wakeLock = null;

async function activarMantenerPantalla() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("Pantalla bloqueada: No se dormirá");
        }
    } catch (err) {
        console.log("Wake Lock no disponible:", err);
    }
}

// Si el usuario cambia de pestaña y vuelve, se reactiva
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        activarMantenerPantalla();
    }
});

// Despertar el motor de audio cada vez que se toca la pantalla
document.body.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
        console.log("Audio despertado por el usuario");
    }
}, true);