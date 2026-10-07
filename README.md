# Revisão de vídeo — Conty

Uma campanha declara quais peças exige. Cada peça acumula versões. A entrega só pode ser aprovada quando a versão atual de cada peça exigida está aprovada. Peça que a campanha não pediu não bloqueia.

## Como rodar

```bash
npm install
npm test
npm run dev
```

A API sobe em `http://localhost:3000` (porta em `PORT`). Os dados ficam em memória e somem quando o processo reinicia.

## Modelo

- **Campanha.** `requiredPieces` é dado gravado na campanha. Valores: `roteiro`, `video`, `capa`, `legenda`.
- **Versão.** `POST .../versions` cria a próxima. Ela vira a atual. As anteriores continuam no histórico, com o status e os comentários que já tinham.
- **Comentário.** `second` + `text`, preso à versão em que foi criado. Se essa versão tem `durationSeconds`, o segundo tem que estar entre 0 e a duração (inclusive). Sem duração, só se exige segundo ≥ 0.
- **Upload.** `source` é uma URL ou um nome de arquivo. Não há storage. O que a regra olha é o status da versão, não o arquivo.

## Regra de aprovação

Uma função: [`src/domain/approveDelivery.ts`](src/domain/approveDelivery.ts).

Ela percorre `campaign.requiredPieces`. Para cada peça, a versão de maior `number` precisa estar `aprovada`. Não há `if (peça === "roteiro")` espalhado. Se faltar alguma, a função lança erro 422 com `pendingPieces` na mesma ordem da campanha.

Aprovar uma versão antiga responde 409. Nova versão de peça exigida devolve a entrega para `em_producao`.

## Exemplos

Criar campanha:

```http
POST /campaigns
Content-Type: application/json

{ "name": "Verão", "requiredPieces": ["video", "legenda"] }
```

```json
{
  "id": "…",
  "name": "Verão",
  "requiredPieces": ["video", "legenda"],
  "deliveryStatus": "em_producao",
  "pieces": {
    "video": { "current": null, "versions": [] },
    "legenda": { "current": null, "versions": [] }
  }
}
```

Nova versão e comentário no segundo 12:

```http
POST /campaigns/:id/pieces/video/versions
{ "source": "arquivo-falso.mp4", "durationSeconds": 30 }

POST /campaigns/:id/pieces/video/versions/:versionId/comments
{ "second": 12, "text": "abre no produto" }
```

Aprovar a versão atual e, em seguida, a entrega:

```http
POST /campaigns/:id/pieces/video/versions/:versionId/approve
POST /campaigns/:id/delivery/approve
```

Se a legenda ainda não tem versão aprovada:

```json
{
  "error": "Entrega não pode ser aprovada: peças obrigatórias pendentes (legenda).",
  "pendingPieces": ["legenda"]
}
```

Outras rotas: `GET /campaigns/:id`, `GET /campaigns/:id/pieces/:piece/versions` e `GET .../versions/:versionId` (a versão devolve os comentários dela).

## Por onde começar

1. A regra em `src/domain/approveDelivery.ts`.
2. Os testes `test/approveDelivery.test.ts` e `test/versions.test.ts`.
3. O HTTP em `src/app.ts` e `test/http.test.ts`.

## O que ficou de fora

- Upload, transcodificação e storage de verdade.
- Autenticação, marcas, pagamento e quem pode comentar.
- Banco durável. A persistência é o `MemoryRepository`; a interface `Repository` isola isso.
- Editar ou apagar comentário, e concorrência na numeração da versão.

## Uso de IA

O código deste repositório foi gerado por um agente de IA (Cursor).

Revisado por Nicolas: [preencher]
