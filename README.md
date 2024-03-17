# duplojs-swagger
[![NPM version](https://img.shields.io/npm/v/@duplojs/swagger)](https://www.npmjs.com/package/@duplojs/swagger)

## Instalation
```
npm i @duplojs/swagger
```

## Implémentation
```ts
import Duplo, {zod} from "@duplojs/duplojs";
import duploSwagger, {SwaggerDescription, SwaggerResponses, SwaggerTag, SwaggerIgnoreInheritDescriptor} from "@duplojs/swagger";

const duplo = Duplo({port: 1506, host: "0.0.0.0"});
duplo.use(duploSwagger, {
    swaggerSpec: {
        tags: [
            {name: "user", description: "Route to iteract with user."}
        ],
    },
});

const isOdd = duplo.createChecker(
    "isOdd", 
    {
        handler(input: number, output, options){
            if(input % 2 == 0) return output("odd", input);
            else return output("notOdd", input);
        },
        outputInfo: ["odd", "notOdd"],
    }, 
    new SwaggerDescription("verif if input is odd")
);

duplo.declareRoute("GET", "/user/{id}")
.extract({
    params: {
        id: zod.enum(["1", "2"]),
    }
})
.check(
    isOdd,
    {
        input: (pickup) => Number(pickup("id")),
        catch: (res, info) => res.code(400).info(info).send(),
    },
    new SwaggerIgnoreInheritDescriptor(),
    new SwaggerDescription("add checker isOdd"),
    new SwaggerResponses({code: 400, description: "Id is not odd."}),
)
.handler(
    ({pickup}, res) => {
        res.code(200).send();
    },
    new SwaggerTag("user"),
    new SwaggerDescription("Get user by name"),
    new SwaggerResponses({code: 200, description: "All is good."}),
);

duplo.launch();
```

## Implémentation globales

```ts
duplo.use(duploSwagger, {
    ...
    globals: true
});
```

tsconfig.json
```json
{
  "compilerOptions": {
    ...
    "types": [
		"@duplojs/swagger/globals"
	],
  }
}
```

## Génération open-api json
```
(node | tsx | ts-node) index.ts --swagger [--only-generate]
```