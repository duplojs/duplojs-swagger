import {DuploConfig, DuploInstance, Request, zod} from "@duplojs/duplojs";
import {duploFindManyDesc} from "@duplojs/editor-tools";
import {Spec as SwaggerSchemaSpec, Response as SwaggerSchemaResponse, Operation as SwaggerSchemaOperation} from "swagger-schema-official";
import {extendZodWithOpenApi} from "@anatine/zod-openapi";

import packageJson from "../package.json";
import indexHtml from "./index.html";
import {readFileSync, writeFileSync} from "fs";
import {SwaggerDeprecated, SwaggerDescription, SwaggerDescriptor, SwaggerIgnore, SwaggerIgnoreInheritDescriptor, SwaggerOperation, SwaggerParameter, SwaggerResponses, SwaggerSchemes, SwaggerTag} from "./descriptor";
import {extractZodToParameter, getZodFromExtract, mapStepSwaggerDescriptor} from "./utility";

export * from "./descriptor";

declare module "@duplojs/duplojs" {
	interface Plugins {
		"@duplojs/swagger": {version: string},
	}
}

type DeepPartial<T extends Record<any, any>> = {
	[P in keyof T]?: T[P] extends Record<any, any> ? DeepPartial<T[P]> : T[P]
};

export interface duploSwaggerOptions {
	outputFile?: string;
	pathDoc?: string;
	pathSwaggerFile?: string;
	index?: string;
	swaggerSpec?: DeepPartial<SwaggerSchemaSpec>;
	disabledDoc?: boolean;
	enabledDocOptionsRoute?: boolean;
}

export default function duploSwagger(
	instance: DuploInstance<DuploConfig>, 
	{
		outputFile = "swagger.json",
		pathDoc = "/swagger",
		pathSwaggerFile = "/swagger.json",
		index,
		swaggerSpec = {},
		disabledDoc = false,
		enabledDocOptionsRoute = false
	}: duploSwaggerOptions = {}
){
	instance.plugins["@duplojs/swagger"] = {version: packageJson.version};
	extendZodWithOpenApi(zod);

	if(disabledDoc === false){
		const stringIndexHtml = index ? readFileSync(index, "utf-8") : indexHtml.replace("{url}", pathSwaggerFile);
		instance.declareRoute("GET", pathDoc)
		.handler(({}, res) => res.code(200).setHeader("content-type", "text/html").send(stringIndexHtml));

		instance.declareRoute("GET", pathSwaggerFile)
		.handler(({}, res) => res.code(200).sendFile(outputFile));
	}

	if(process.argv.indexOf("--swagger") !== -1){
		const swagger: SwaggerSchemaSpec = {
			...swaggerSpec,

			info: {
				title: "swagger",
				version: "3.0.0",
				...swaggerSpec.info
			},
			swagger: swaggerSpec.swagger || "2.0",
			paths: {
				...swaggerSpec.paths as SwaggerSchemaSpec["paths"]
			}
		};

		//find Descriptors from all checker
		const checkerDescriptors: Record<string, SwaggerDescriptor[]> = {};
		instance.addHook("onCreateChecker", (checker) => {
			checkerDescriptors[checker.name] = checker.desc.filter((desc) => desc instanceof SwaggerDescriptor);
		});

		//find Descriptors from all process
		const processDescriptors: Record<string, SwaggerDescriptor[]> = {};
		instance.addHook("onCreateProcess", (process) => {
			processDescriptors[process.name] = duploFindManyDesc(process, (desc) => desc instanceof SwaggerDescriptor) || [];
			processDescriptors[process.name].push(
				...getZodFromExtract(process.extracted)
				.map(v => extractZodToParameter[v.key]?.(v))
				.filter(v => !!v)
			);
			processDescriptors[process.name].push(
				...mapStepSwaggerDescriptor(process, "process", processDescriptors),
				...mapStepSwaggerDescriptor(process, "checker", checkerDescriptors),
			);
		});

		//find Descriptors from all abstract
		const abstractDescriptors: Record<string, SwaggerDescriptor[]> = {};
		instance.addHook("onDeclareAbstractRoute", (abstract) => {
			abstractDescriptors[abstract.name] = duploFindManyDesc(abstract, (desc) => desc instanceof SwaggerDescriptor) || [];
			abstractDescriptors[abstract.name].push(
				...getZodFromExtract(abstract.extracted)
				.map(v => extractZodToParameter[v.key]?.(v))
				.filter(v => !!v)
			);
			abstractDescriptors[abstract.name].push(
				...mapStepSwaggerDescriptor(abstract, "process", processDescriptors),
				...mapStepSwaggerDescriptor(abstract, "checker", checkerDescriptors),
				//Inherit SwaggerDescriptor abstract
				...(() => {
					if(abstract.parentAbstractRoute || abstract.mergeAbstractRoute){
						const descStep = abstract.descs.find(v => v.type === "abstract")?.descStep;
						// check if desc of step has SwaggerIgnoreInheritDescriptor to don't Inherit SwaggerDescriptor
						if(descStep && descStep.find(v => v instanceof SwaggerIgnoreInheritDescriptor)) return [];
						else if(abstract.parentAbstractRoute) return abstractDescriptors[abstract.parentAbstractRoute.name];
						else if(abstract.mergeAbstractRoute){
							return abstract.mergeAbstractRoute.map(v => abstractDescriptors[v.name]).flat(1);
						}
						else return [];
					}
					else return [];
				})(),
			);
		});

		instance.addHook("onDeclareRoute", (route) => {
			if(route.method === "OPTIONS" && enabledDocOptionsRoute === false) return;
			if(duploFindManyDesc(route, (desc) => desc instanceof SwaggerIgnore, "handler")) return; 

			const descriptors: (SwaggerDescriptor)[] = duploFindManyDesc(route, (desc) => desc instanceof SwaggerDescriptor) || [];
			descriptors.push(
				...getZodFromExtract(route.extracted)
				.map(v => extractZodToParameter[v.key as keyof typeof extractZodToParameter]?.(v))
				.filter(v => !!v)
			);
			descriptors.push(
				...mapStepSwaggerDescriptor(route, "process", processDescriptors),
				...mapStepSwaggerDescriptor(route, "checker", checkerDescriptors),
				//Inherit SwaggerDescriptor abstract
				...(() => {
					if(route.abstractRoute){
						const descStep = route.descs.find(v => v.type === "abstract")?.descStep;
						// check if desc of step has SwaggerIgnoreInheritDescriptor to don't Inherit SwaggerDescriptor
						if(descStep && descStep.find(v => v instanceof SwaggerIgnoreInheritDescriptor)) return [];
						return abstractDescriptors[route.abstractRoute.name];
					}
					else return [];
				})(),
			);
			
			const schemes: (SwaggerSchemes)[] = duploFindManyDesc(route, (desc) => desc instanceof SwaggerSchemes, "handler") || [];
			const tags: (SwaggerTag)[] = duploFindManyDesc(route, (desc) => desc instanceof SwaggerTag, "handler") || [];
			const responses: (SwaggerResponses)[] = descriptors.filter(v => v instanceof SwaggerResponses) as any;
			const parameters: (SwaggerParameter)[] = descriptors.filter(v => v instanceof SwaggerParameter) as any;
			const descriptions: (SwaggerDescription)[] = descriptors.filter(v => v instanceof SwaggerDescription) as any;
			const deprecated: (SwaggerDeprecated)[] | null = duploFindManyDesc(route, (desc) => desc instanceof SwaggerDeprecated, "handler");
			const operations: (SwaggerOperation)[] = descriptors.filter(v => v instanceof SwaggerOperation) as any;
			
			const buildSchemes = schemes.map(v => v.value);
			const buildTag = tags.map(v => v.value);
			const buildResponse = responses.reduce(
				(pv, cv) => {
					pv[cv.code] = {
						description: cv.value.description || "",
						schema: cv.value.schema,
						examples: cv.value.examples,
					};
					return pv;
				}, 
				{} as Record<string, SwaggerSchemaResponse>
			);
			const buildParameters = parameters.map(v => v.value);
			const buildDescriptions = descriptions.map(v => v.value).join("\n");
			const builddeprecated = !!deprecated;
			const BuildOperation = operations.reduce(
				(pv, cv) => ({...pv, ...cv.value}), 
				{} as Partial<SwaggerSchemaOperation>
			);

			route.path.forEach(path => {
				if(!swagger.paths[path])swagger.paths[path] = {};

				swagger.paths[path][route.method.toLowerCase() as Lowercase<Request["method"]>] = {
					responses: buildResponse,
					parameters: buildParameters,
					tags: buildTag,
					schemes: buildSchemes,
					description: buildDescriptions,
					deprecated: builddeprecated,
					...BuildOperation,
				};
			});
		});
		
		instance.addHook("beforeBuildRouter", () => writeFileSync(outputFile, JSON.stringify(swagger, undefined, 4)));

		if(process.argv.indexOf("--only-generate") !== -1){
			instance.addHook("beforeBuildRouter", () => process.exit());
		}
	}
}
