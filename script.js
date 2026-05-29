// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://xtbiuwsfpjblhdchzzru.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vKi-afmqvT78rpm_DnLj-w_8zZ2Fdxq';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FERRAMENTAS DE DATA ---

// 1. Transforma AAAA-MM-DD (input) em DD/MM/AAAA (banco/planilha)
function formatarParaBR(dataISO) {
    if (!dataISO) return "";
    const partes = dataISO.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// 2. Transforma DD/MM/AAAA (banco) em Objeto Date (para o JS calcular atraso)
function converterBRParaDate(dataBR) {
    if (!dataBR) return new Date();
    const partes = dataBR.split("/");
    // Formato: Ano, Mês (0-11), Dia
    return new Date(partes[2], partes[1] - 1, partes[0], 0, 0, 0);
}

// Função para pegar a data de hoje no formato ISO para restrições do input
function obterDataHojeISO() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// --- CONTROLE DE INPUTS ---
const inEmp = document.getElementById('dataEmprestimo');
const inPrazo = document.getElementById('prazo');
const hojeISO = obterDataHojeISO();

inEmp.min = hojeISO;

inEmp.addEventListener('change', () => {
    if (inEmp.value) {
        inPrazo.disabled = false;
        inPrazo.min = inEmp.value;
        if (inPrazo.value && inPrazo.value < inEmp.value) {
            inPrazo.value = "";
        }
    } else {
        inPrazo.disabled = true;
    }
});

// --- REGISTRAR EMPRÉSTIMO ---
document.getElementById('formEmprestimo').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btnSubmit = this.querySelector('button[type="submit"]');
    const textoOriginal = btnSubmit.innerText;
    
    btnSubmit.innerText = "Registrando... aguarde";
    btnSubmit.disabled = true;
    
    const dados = {
    monitor: document.getElementById('monitor').value,
    tipo: document.getElementById('tipoUsuario').value,
    nomeUsuario: document.getElementById('tipoUsuario').value === "Professor"
        ? document.getElementById('nomeUsuarioSelect').value
        : document.getElementById('nomeUsuarioInput').value,
    objeto: document.getElementById('objeto').value,
    dataEmprestimo: formatarParaBR(inEmp.value),
    prazo: formatarParaBR(inPrazo.value),
    status: 'Emprestado',
    
    // Captura o RA apenas se for Aluno, senão envia vazio ou "N/A"
    ra: document.getElementById('tipoUsuario').value === "Professor" 
        ? "---" 
        : document.getElementById('raAluno').value
};

    const { error } = await _supabase.from('emprestimos').insert([dados]);

    if (error) {
        alert("Erro ao salvar: " + error.message);
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
    } else {
        btnSubmit.innerText = "Registrado com Sucesso!";
        btnSubmit.style.backgroundColor = "#27ae60";
        
        setTimeout(() => {
            document.getElementById('formEmprestimo').reset();
            inPrazo.disabled = true;
            btnSubmit.innerText = textoOriginal;
            btnSubmit.style.backgroundColor = ""; 
            btnSubmit.disabled = false;
            carregarDados();
        }, 1500);
    }
});

// --- LISTAR DADOS ---
async function carregarDados() {
    const { data, error } = await _supabase
        .from('emprestimos')
        .select('*')
        .eq('status', 'Emprestado');

    if (error) {
        console.error("Erro ao carregar:", error);
        return;
    }

    const tAlunos = document.querySelector('#tabelaAlunos tbody');
    const tAtrasados = document.querySelector('#tabelaAtrasados tbody');
    const tProfs = document.querySelector('#tabelaProfessores tbody');
    
    tAlunos.innerHTML = "";
    tAtrasados.innerHTML = "";
    tProfs.innerHTML = "";

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    data.forEach(async (item) => {
        
        // CONVERTE O TEXTO DO BANCO PARA DATA PARA COMPARAR ATRASO
        const { count } = await _supabase
        .from('emprestimos')
        .select('*', { count: 'exact', head: true })
        .eq('ra', item.ra)
        .eq('statusPrazo', 'ATRASADO');

        const classeBlacklist = (count >= 3) ? 'usuario-blacklist' : '';

        const linha = `<tr>
            <td>${item.objeto}</td>
            <td class="${classeBlacklist}">${item.nomeUsuario}<br><small>RA: ${item.ra || 'N/A'}</small></td>
            <td><button class="btn-ok" onclick="entregar(${item.id})">OK</button></td>
        </tr>`;

        if (item.tipo === "Professor") {
            tProfs.innerHTML += linha;
        } else if (prazoData < hoje) {
            tAtrasados.innerHTML += linha;
        } else {
            tAlunos.innerHTML += linha;
        }
    });
}

async function verificarHistoricoAtrasos(ra) {
    if (ra.length < 6) return; // Só checa se o RA estiver completo

    const { count, error } = await _supabase
        .from('emprestimos')
        .select('*', { count: 'exact', head: true }) // head: true faz a consulta ser rápida, só conta
        .eq('ra', ra)
        .eq('statusPrazo', 'ATRASADO');

    const aviso = document.getElementById('msgAvisoBlacklist');
    
    if (count >= 3) {
        aviso.style.display = 'block'; // Mostra o alerta vermelho
    } else {
        aviso.style.display = 'none'; // Esconde se estiver limpo
    }
}

// Evento para checar enquanto o monitor digita
document.getElementById('raAluno').addEventListener('input', function(e) {
    verificarHistoricoAtrasos(e.target.value);
});

// --- DEVOLUÇÃO (MODAL) ---
let idItemDevolucao = null;

function entregar(id) {
    idItemDevolucao = id;
    document.getElementById('modalDevolucao').style.display = 'flex';
    document.getElementById('monitorRecebedor').value = '';
    document.getElementById('monitorRecebedor').focus();
}

function fecharModal() {
    document.getElementById('modalDevolucao').style.display = 'none';
    idItemDevolucao = null;
}

async function confirmarDevolucao() {
    const monitor = document.getElementById('monitorRecebedor').value;
    
    if (!monitor.trim()) {
        alert("Por favor, selecione o monitor.");
        return;
    }

    const btn = document.querySelector('.btn-confirmar');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        const { data: item, error: errorFetch } = await _supabase
            .from('emprestimos')
            .select('prazo')
            .eq('id', idItemDevolucao)
            .single();

        if (errorFetch) throw errorFetch;

        const hoje = new Date();
        const dataPrazo = converterBRParaDate(item.prazo);
        
        hoje.setHours(0,0,0,0);
        dataPrazo.setHours(0,0,0,0);

        // Gera a data de hoje no formato BR
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        const dataFormatadaBR = `${dia}/${mes}/${ano}`;

        let infoPrazo = hoje > dataPrazo ? "ATRASADO" : "NO PRAZO";

        const { error: errorUpdate } = await _supabase
            .from('emprestimos')
            .update({ 
                status: 'Devolvido', 
                monitorRecebeu: monitor,
                statusPrazo: infoPrazo,
                dataDevolucao: dataFormatadaBR
            })
            .eq('id', idItemDevolucao);

        if (errorUpdate) throw errorUpdate;

        fecharModal();
        carregarDados();
        
    } catch (err) {
        console.error("Erro no registro:", err);
        alert("Erro ao processar devolução.");
    } finally {
        btn.innerText = "Confirmar Entrega";
        btn.disabled = false;
    }
}

// --- CARREGAMENTO INICIAL DE MONITORES E PROFS ---
async function carregarMonitores() {
    const { data, error } = await _supabase
        .from('monitores')
        .select('nome')
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) return;

    const selectSaida = document.getElementById('monitor');
    const selectRecebimento = document.getElementById('monitorRecebedor');
    const opPadrao = '<option value="">Selecione um monitor</option>';
    
    selectSaida.innerHTML = opPadrao;
    selectRecebimento.innerHTML = opPadrao;

    data.forEach(m => {
        const option = `<option value="${m.nome}">${m.nome}</option>`;
        selectSaida.innerHTML += option;
        selectRecebimento.innerHTML += option;
    });
}

async function carregarProfessores() {
    const { data, error } = await _supabase
        .from('professores')
        .select('nome')
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) return;

    const selectProf = document.getElementById('nomeUsuarioSelect');
    selectProf.innerHTML = '<option value="">Selecione o Professor</option>';
    data.forEach(p => {
        selectProf.innerHTML += `<option value="${p.nome}">${p.nome}</option>`;
    });
}

// --- LÓGICA DE INTERFACE ---
document.getElementById('tipoUsuario').addEventListener('change', function() {
    const tipo = this.value;
    const inputAluno = document.getElementById('nomeUsuarioInput');
    const selectProf = document.getElementById('nomeUsuarioSelect');
    const containerRA = document.getElementById('containerRA'); // Referência ao container do RA
    const raInput = document.getElementById('raAluno'); // Referência ao input do RA

    if (tipo === "Professor") {
        // Esconde campos de Aluno
        inputAluno.style.display = "none";
        inputAluno.required = false;
        
        containerRA.style.display = "none"; // ESCONDE O RA
        raInput.required = false;           // Tira a obrigatoriedade
        raInput.value = "";                 // Limpa o campo para não enviar lixo

        // Mostra campos de Professor
        selectProf.style.display = "block";
        selectProf.required = true;
    } else {
        // Mostra campos de Aluno
        inputAluno.style.display = "block";
        inputAluno.required = true;
        
        containerRA.style.display = "block"; // MOSTRA O RA
        raInput.required = true;             // Torna o RA obrigatório para alunos

        // Esconde campos de Professor
        selectProf.style.display = "none";
        selectProf.required = false;
    }
});

window.addEventListener('DOMContentLoaded', () => {
    carregarMonitores();
    carregarProfessores();
    carregarDados(); 
});

window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    setTimeout(() => {
        splash.classList.add('splash-hidden');
    }, 2000); 
});