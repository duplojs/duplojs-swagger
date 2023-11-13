import {Operation as SwaggerSchemaOperation, Parameter as SwaggerSchemaParameter, Response as SwaggerSchemaResponse} from "swagger-schema-official";

export abstract class SwaggerDescriptor<val = any>{
	constructor(value: val){
		this.value = value;
	}
	
	value: val;
}

export class SwaggerIgnore extends SwaggerDescriptor{
	constructor(){
		super(undefined);
	}
}

export class SwaggerResponses extends SwaggerDescriptor<SwaggerSchemaResponse>{
	constructor(value: SwaggerSchemaResponse & {code: number}){
		super(value);
		this.code = `${value.code}`;
	}

	code: string;
}

export class SwaggerParameter extends SwaggerDescriptor<SwaggerSchemaParameter>{
	constructor(value: SwaggerSchemaParameter){
		super(value);
	}
}

export class SwaggerTag extends SwaggerDescriptor<string>{
	constructor(name: string){
		super(name);
	}
}

export class SwaggerSchemes extends SwaggerDescriptor<string>{
	constructor(name: string){
		super(name);
	}
}

export class SwaggerDescription extends SwaggerDescriptor<string>{
	constructor(description: string){
		super(description);
	}
}

export class SwaggerDeprecated extends SwaggerDescriptor{
	constructor(){
		super(undefined);
	}
}

export class SwaggerOperation extends SwaggerDescriptor<Partial<SwaggerSchemaOperation>>{
	constructor(value: Partial<SwaggerSchemaOperation>){
		super(value);
	}
}

export class SwaggerIgnoreInheritDescriptor extends SwaggerDescriptor{
	constructor(){
		super(undefined);
	}
}
