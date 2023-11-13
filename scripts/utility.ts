import {RouteExtractObj, ProcessExtractObj, zod, ProcessExport, Route, AbstractRoute, StepProcess, StepChecker} from "@duplojs/duplojs";
import {SwaggerDescriptor, SwaggerIgnoreInheritDescriptor, SwaggerParameter} from "./descriptor";
import {generateSchema} from "@anatine/zod-openapi";

export type ExtractZod = {
	key: keyof RouteExtractObj | keyof ProcessExtractObj,
	subKey?: string,
	zod: zod.ZodType,
}

export const getZodFromExtract = (extract: RouteExtractObj | ProcessExtractObj) => {
	const zods: ExtractZod[] = [];
	extract = {...extract};
	if(extract.body && !(extract.body instanceof zod.ZodType))extract.body = zod.object(extract.body);

	Object.entries(extract).forEach(([key, value]) => {
		if(value instanceof zod.ZodType)zods.push({
			key: key as any,
			zod: value,
		});
		else Object.entries(value).forEach(([subKey, subValue]) => {
			if(subValue instanceof zod.ZodType)zods.push({
				key: key as any,
				subKey,
				zod: subValue,
			});
		});
	});

	return zods;
};

export const extractZodToParameter: Record<string, (extractZod: ExtractZod) => SwaggerParameter> = {
	params: ({subKey, zod}) => {
		//@ts-ignore
		return new SwaggerParameter({
			in: "path",
			name: subKey as string,
			...generateSchema(zod),
			required: true,
		});
	},
	body: ({subKey, zod}) => {
		//@ts-ignore
		return new SwaggerParameter({
			in: "body",
			name: subKey as string,
			...generateSchema(zod),
		});
	},
	query: ({subKey, zod}) => {
		//@ts-ignore
		return new SwaggerParameter({
			in: "query",
			name: subKey as string,
			...generateSchema(zod),
		});
	},
	headers: ({subKey, zod}) => {
		//@ts-ignore
		return new SwaggerParameter({
			in: "header",
			name: subKey as string,
			...generateSchema(zod),
		});
	},
};

export const mapStepSwaggerDescriptor = <
	duploses extends ProcessExport | Route | AbstractRoute
>(duploses: duploses, type: "checker" | "process", duplosesDescriptors: Record<string, SwaggerDescriptor[]>) => duploses
	.steps
	.filter(v => v.type === type)
	.map((v, index) => {
		v = v as StepProcess | StepChecker;
		const descStep = duploses.descs.find(v => v.type === type && v.index === index)?.descStep;
		// check if desc of step has SwaggerIgnoreInheritDescriptor to don't Inherit SwaggerDescriptor
		if(descStep && descStep.find(v => v instanceof SwaggerIgnoreInheritDescriptor)) return []; 
		return duplosesDescriptors[v.name];
	})
	.flat(1);

export const mapAccessSwaggerDescriptor = <
	duploses extends Route | AbstractRoute
>(duploses: duploses, duplosesDescriptors: Record<string, SwaggerDescriptor[]>) => {
	if(!duploses.access || typeof duploses.access === "function") return [];
	const descStep = duploses.descs.find(v => v.type === "access")?.descStep;
	// check if desc of step has SwaggerIgnoreInheritDescriptor to don't Inherit SwaggerDescriptor
	if(descStep && descStep.find(v => v instanceof SwaggerIgnoreInheritDescriptor)) return []; 
	return duplosesDescriptors[duploses.access.name];
};
