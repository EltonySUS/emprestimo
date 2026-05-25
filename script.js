// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://xtbiuwsfpjblhdchzzru.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vKi-afmqvT78rpm_DnLj-w_8zZ2Fdxq';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CONTROLE DE DATAS ---
const inEmp = document.getElementById('dataEmprestimo');
const inPrazo = document.getElementById('prazo');

// Função para pegar a data de hoje no formato AAAA-MM-DD (Local)
function obterDataHoje() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Inicialização das restrições de data
const hoje = obterDataHoje();
inEmp.min = hoje; // Impede selecionar dias anteriores a hoje no empréstimo

inEmp.addEventListener('change', () => {
    if (inEmp.value) {
        inPrazo.disabled = false; // Destrava o campo de prazo
        inPrazo.min = inEmp.value; // O prazo não pode ser antes do empréstimo
        
        // Se o usuário mudar o empréstimo para uma data maior que o prazo já escolhido, limpa o prazo
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
        dataEmprestimo: inEmp.value,
        prazo: inPrazo.value,
        status: 'Emprestado'
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
            inPrazo.disabled = true; // Bloqueia o prazo novamente para o próximo registro
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

    const hojeData = new Date(obterDataHoje());

    data.forEach(item => {
        // Ajuste para ler a data do banco sem erro de fuso horário
        const prazoData = new Date(item.prazo + 'T00:00:00');

        const linha = `<tr>
            <td>${item.objeto}</td>
            <td>${item.nomeUsuario}<br><small>Monitor: ${item.monitor}</small></td>
            <td><button class="btn-ok" onclick="entregar(${item.id})">OK</button></td>
        </tr>`;

        if (item.tipo === "Professor") {
            tProfs.innerHTML += linha;
        } else if (prazoData < hojeData) {
            tAtrasados.innerHTML += linha;
        } else {
            tAlunos.innerHTML += linha;
        }
    });
}

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
        alert("Por favor, digite o nome do monitor.");
        return;
    }

    const btn = document.querySelector('.btn-confirmar');
    btn.innerText = "Salvando...";
    btn.disabled = true;
    
    const { error } = await _supabase
        .from('emprestimos')
        .update({ status: 'Devolvido', monitorRecebeu: monitor })
        .eq('id', idItemDevolucao);

    if (error) {
        alert("Erro: " + error.message);
        btn.innerText = "Confirmar Entrega";
        btn.disabled = false;
    } else {
        fecharModal();
        carregarDados();
        btn.innerText = "Confirmar Entrega";
        btn.disabled = false;
    }
}

async function carregarMonitores() {
    const { data, error } = await _supabase
        .from('monitores')
        .select('nome')
        .eq('ativo', true) // Pega só quem não está arquivado
        .order('nome', { ascending: true });

    if (error) {
        console.error("Erro ao buscar monitores:", error);
        return;
    }

    // Seleciona os dois campos (o do formulário e o do modal)
    const selectSaida = document.getElementById('monitor');
    const selectRecebimento = document.getElementById('monitorRecebedor');

    // Limpa as opções atuais e adiciona a padrão
    const opPadrao = '<option value="">Selecione um monitor</option>';
    selectSaida.innerHTML = opPadrao;
    selectRecebimento.innerHTML = opPadrao;

    // Preenche com os nomes do banco
    data.forEach(m => {
        const option = `<option value="${m.nome}">${m.nome}</option>`;
        selectSaida.innerHTML += option;
        selectRecebimento.innerHTML += option;
    });
}

document.getElementById('tipoUsuario').addEventListener('change', function() {
    const tipo = this.value;
    const campoMonitor = document.getElementById('monitor');

    if (tipo === "Professor") {
        // Exemplo: Destacar o campo ou aplicar uma regra específica
        campoMonitor.style.borderColor = "#3498db";
        console.log("Monitor, atenção: Empréstimo para Professor detectado.");
    } else {
        campoMonitor.style.borderColor = "";
    }
});

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

// --- LÓGICA DE TROCA (ALUNO VS PROFESSOR) ---
document.getElementById('tipoUsuario').addEventListener('change', function() {
    const tipo = this.value;
    const inputAluno = document.getElementById('nomeUsuarioInput');
    const selectProf = document.getElementById('nomeUsuarioSelect');

    if (tipo === "Professor") {
        inputAluno.style.display = "none";
        inputAluno.required = false;
        
        selectProf.style.display = "block";
        selectProf.required = true;
    } else {
        inputAluno.style.display = "block";
        inputAluno.required = true;
        
        selectProf.style.display = "none";
        selectProf.required = false;
    }
});

// Chame essa função quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
    carregarMonitores();
    carregarProfessores();
    carregarDados(); 
});

// pagina de inicio (Splash Screen)
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    
    // Define um tempo mínimo de 2 segundos para a splash screen aparecer
    setTimeout(() => {
        splash.classList.add('splash-hidden');
    }, 2000); 
});