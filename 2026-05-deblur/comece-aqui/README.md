# Comece aqui

Esse documento dá o contexto teórico do desafio - o que é deconvolução, por que FFT entra na história, como o filtro de Wiener funciona - em linguagem direta.
Se você já está confortável com esses temas, pula direto pro [README](../README.md).

## O que é "deconvolução"?

Pensa numa câmera fora de foco.
No sensor, cada ponto da cena não cai como um ponto - ele se espalha numa pequena mancha (pelo formato da lente, abertura, foco errado, etc.).
A imagem que você grava é, na prática, a **soma de todas essas pequenas manchas**: cada pixel da foto recebe contribuições não só do "ponto correto" da cena, mas também dos pontos vizinhos que se espalharam até ali.

Esse processo de "ponto da cena vira mancha no sensor" tem nome: **convolução**.
A mancha em si - o formato como um único ponto se espalha - se chama **kernel**, ou **PSF** (point spread function, "função de espalhamento de ponto").
No caso do drone do desafio, a PSF é aproximadamente uma gaussiana: uma manchinha redonda, mais densa no centro, esmaecendo nas bordas.
A "largura" dessa gaussiana é o parâmetro `σ` (sigma) - quanto maior σ, mais espalhada a mancha, mais borrada a imagem.
O σ é sorteado por frame em `U(0, 3.5)` (faixa declarada na [spec](../README.md#como-o-frame-foi-gerado)): a faixa é conhecida, mas o valor exato de cada frame não - sua solução estima o σ a partir da imagem ou roda sobre toda a faixa.

Visualmente, três níveis de borrão na mesma imagem:

| σ pequeno (autofoco quase certo) | σ médio | σ grande (autofoco perdido) |
|:---:|:---:|:---:|
| ![sigma pequeno](docs/sigma_1_5.png) | ![sigma médio](docs/sigma_2_5.png) | ![sigma grande](docs/sigma_3_5.png) |

**Deconvolução** é o problema inverso: dada a imagem manchada (a foto borrada do drone), recuperar a imagem original (como se a câmera tivesse focado direito).
Em palavras: "se eu sei mais ou menos o formato da manchinha que cada ponto virou, será que dá pra desfazer essa soma?"

A resposta curta é: **dá, mais ou menos**.
Por dois motivos a coisa não é trivial:

1. **A informação se perde.**
   Quando dois pontos da cena se espalham e somam no mesmo pixel, você guarda só a soma - não dá pra distinguir cenas diferentes que produziriam a mesma soma.
   Borrar é tipo somar números; desborrar é tipo tentar descobrir quais foram as parcelas sabendo só o resultado.
2. **Tem ruído.**
   O sensor adiciona um chiado de ruído eletrônico em cada pixel.
   Esse ruído contamina principalmente as **frequências altas** (os detalhes finos da imagem), que são justamente o que você quer recuperar.
   Toda técnica de deblur tem que lidar com esse ruído ou o resultado explode em granulação.

| Frame borrado (entrada) | Saída do Wiener (referência) | Imagem original (ground truth) |
|:---:|:---:|:---:|
| ![entrada](docs/house_inputs.png) | ![wiener](docs/house_wiener.png) | ![ground truth](docs/house_expected.png) |

## Por que pensar em "frequências"?

Aqui mora o truque chave de todo o problema.
Existe um teorema clássico de processamento de sinal que diz o seguinte:

> **Convolução no espaço de pixels é equivalente a multiplicação no domínio de frequências.**

Em palavras: se você representar tanto a imagem quanto o kernel não como matrizes de pixels, mas como matrizes de "frequências espaciais" (oscilações finas e oscilações grossas que compõem a imagem), o efeito complicado de borrar vira simplesmente uma **multiplicação ponto-a-ponto** entre as duas matrizes.

A ferramenta que faz essa tradução pixels <-> frequências se chama **Transformada de Fourier**.
Na versão eficiente que computadores usam, ela se chama **FFT** (Fast Fourier Transform).
Você passa uma imagem 512x512 pra FFT, sai uma matriz 512x512 onde cada célula representa "quanta energia tem nessa frequência espacial específica".
E a operação inversa, a **IFFT**, faz o caminho de volta: dada a matriz de frequências, reconstrói a imagem.

Isso transforma o problema de deconvolução em algo bem mais tratável - você sai de "desfazer uma soma complicada" pra "desfazer uma multiplicação".

## A ideia ingênua: dividir

Se borrar é multiplicar no domínio de frequências:

```
imagem_borrada(freq) = imagem_nítida(freq) * kernel(freq)
```

Então pra desborrar é só dividir, certo?

```
imagem_nítida(freq) = imagem_borrada(freq) / kernel(freq)
```

E isso de fato funciona - **na ausência de ruído**.
Com ruído, é catastrófico.
A razão: o `kernel(freq)` típico de um borrão tem valores muito pequenos justamente nas frequências altas (porque borrão é exatamente a operação que mata detalhe fino).
Dividir um número pequeno por outro número quase zero amplifica enormemente qualquer coisa que esteja naquela frequência - inclusive o ruído eletrônico que estava ali e que você queria ignorar.
Resultado: a imagem "desborrada" sai cheia de granulado, muitas vezes pior que a borrada original.

## Wiener: dividir com cuidado

O **filtro de Wiener** resolve esse problema com um ajuste pequeno mas decisivo.
Em vez de dividir cru, ele aplica:

```
filtro(freq) = conj(kernel(freq)) / ( |kernel(freq)|^2 + lambda )
```

A constante `lambda` é o **parâmetro de regularização**.
Ela faz com que, nas frequências onde o kernel é muito pequeno (e dividir cru explodiria), o filtro suavemente "desista" de tentar recuperar aquela frequência em vez de amplificar o ruído.

A intuição:

- **lambda pequeno**: o filtro confia muito no kernel e tenta recuperar até as frequências mais altas - isso traz mais detalhe, mas também mais ruído amplificado.
- **lambda grande**: o filtro vira mais suave - menos ruído, mas perde detalhe fino.

Calibrar lambda é parte da arte, e idealmente depende da intensidade do ruído e da intensidade do borrão.

A referência que vem no repo ([`reference/wiener.py`](reference/wiener.py)) usa um `lambda` e um kernel fixos, sem nenhuma adaptação ao frame que recebe.
Esse é o **Wiener cego ingênuo**: como ele não estima nada, quando os parâmetros reais do frame ficam perto desses chutes o resultado sai razoável; quando se distanciam, sofre.

## Por onde sua solução pode melhorar

A referência ignora pelo menos duas coisas que sua solução pode atacar:

### 1. Estimar o σ do frame

O σ varia entre frames dentro de `U(0, 3.5)`, mas o Wiener da referência aplica o mesmo σ pra todo mundo.
Se você consegue estimar o σ verdadeiro a partir da imagem borrada que recebeu, já melhora significativamente.
Algumas técnicas clássicas:

- **Análise do espectro de potência.**
  O log do espectro de frequências de uma imagem borrada por gaussiana tem uma assinatura previsível (uma reta, mais ou menos).
  Ajustar essa reta dá uma estimativa direta de σ.
- **Sweep + métrica de foco.**
  Tenta vários valores candidatos de σ, mede o quão "nítida" cada reconstrução parece (usando variância do gradiente, total variation, ou outra métrica de foco), escolhe a melhor.

### 2. Ir além do Wiener

Wiener é uma solução fechada e rápida (uma FFT, uma multiplicação, uma IFFT) - ótima pro orçamento de 200 ms.
Mas existem técnicas iterativas que sacrificam tempo por qualidade:

- **Richardson-Lucy**: cada iteração refina a estimativa, baseada num modelo probabilístico do ruído.
- **TV-regularizado** (total variation): assume que a imagem nítida tem bordas mas é suave dentro de regiões - bom pra fotos naturais.

Em 200 ms você não roda 50 iterações de Richardson-Lucy, mas 3 a 5 passos podem caber e ajudar bastante - especialmente combinados com uma boa estimativa inicial via Wiener.

## Pra continuar

- A spec completa do desafio está no [README](../README.md).
- O modelo de geração do frame - a estrutura matemática do borrão e do ruído, e as faixas dos parâmetros - está documentado na seção "[Como o frame foi gerado](../README.md#como-o-frame-foi-gerado)".
  Sua solução **pode e deve** explorar essa estrutura.
- O código de referência está em [`reference/wiener.py`](reference/wiener.py) - leitura curta, ~50 linhas de Python + numpy.
  Boa primeira leitura pra ver o pipeline FFT -> filtro -> IFFT acontecendo na prática.

## Referências e leituras

Material pra ir além do que tem aqui, agrupado por nível de profundidade.
Não é uma lista exaustiva - é o "se você gostou do tema, comece por aqui".

### Material introdutório (gratuito, online)

- **3Blue1Brown** - dois vídeos cobrem direto a teoria que o desafio usa:
  - ["But what is the Fourier Transform? A visual introduction"](https://www.youtube.com/watch?v=spUNpyF58BY) (~21 min) - intuição visual da Transformada de Fourier.
  - ["But what is a convolution?"](https://www.youtube.com/watch?v=KuXjwB4LzSA) (~23 min) - convolução em probabilidade e processamento de imagem, fechando com a aceleração via FFT.
- **Steven W. Smith - "The Scientist and Engineer's Guide to Digital Signal Processing"** ([dspguide.com](https://www.dspguide.com/), gratuito online; [TOC completo](https://www.dspguide.com/pdfbook.htm)).
  Capítulos diretamente relevantes pro desafio: [6 - Convolution](https://www.dspguide.com/ch6.htm), [12 - The Fast Fourier Transform](https://www.dspguide.com/ch12.htm), [17 - Custom Filters](https://www.dspguide.com/ch17.htm) (inclui seção sobre deconvolução), [18 - FFT Convolution](https://www.dspguide.com/ch18.htm) e [24 - Linear Image Processing](https://www.dspguide.com/ch24.htm). Linguagem direta com analogias antes das fórmulas.
- **Wikipedia** - referências rápidas e confiáveis pros conceitos chave: [Wiener filter](https://en.wikipedia.org/wiki/Wiener_filter), [Richardson-Lucy deconvolution](https://en.wikipedia.org/wiki/Richardson%E2%80%93Lucy_deconvolution), [Total variation denoising](https://en.wikipedia.org/wiki/Total_variation_denoising), [Deconvolution](https://en.wikipedia.org/wiki/Deconvolution).

### Textbooks clássicos

- **Gonzalez & Woods - "Digital Image Processing"** (4ª ed., Pearson, 2018) - [site oficial dos autores](https://www.imageprocessingplace.com/).
  Capítulo 4 ("Filtering in the Frequency Domain") cobre Fourier e FFT no contexto de imagem; capítulo 5 ("Image Restoration and Reconstruction") tem o filtro de Wiener (seção 5.8), filtragem inversa, regularização e métodos iterativos.
- **Oppenheim, Schafer & Buck - "Discrete-Time Signal Processing"** (3ª ed., Pearson) - [Google Books](https://books.google.com/books/about/Discrete_time_Signal_Processing.html?id=Bv1SAAAAMAAJ).
  Capítulos 8 ("The Discrete Fourier Transform") e 9 ("Computation of the Discrete Fourier Transform") são a fonte canônica pra DFT e FFT. Pesado em matemática, mas é a referência pro que aparece simplificado nos textos introdutórios.

### Papers originais (deconvolução iterativa e regularização)

- Richardson, W. H. (1972). ["Bayesian-Based Iterative Method of Image Restoration"](https://doi.org/10.1364/JOSA.62.000055). *Journal of the Optical Society of America*, 62(1), 55-59.
  Paper original do que ficou conhecido como algoritmo Richardson-Lucy.
- Lucy, L. B. (1974). ["An iterative technique for the rectification of observed distributions"](https://ui.adsabs.harvard.edu/abs/1974AJ.....79..745L/abstract). *Astronomical Journal*, 79, 745. ([PDF na NASA ADS](https://adsabs.harvard.edu/pdf/1974AJ.....79..745L))
  Mesma ideia derivada independentemente em contexto de astronomia, daí o nome composto Richardson-Lucy.
- Rudin, L. I., Osher, S., & Fatemi, E. (1992). ["Nonlinear total variation based noise removal algorithms"](https://doi.org/10.1016/0167-2789(92)90242-F). *Physica D*, 60(1-4), 259-268. ([PDF](https://web.eecs.utk.edu/~hqi/ece692/references/noise-TV-PhysicaD92.pdf))
  Paper fundador do TV-regularizado, conhecido na literatura como "modelo ROF".
